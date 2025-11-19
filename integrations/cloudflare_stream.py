# integrations/cloudflare_stream.py
import base64
import time
import requests
import jwt
from django.conf import settings

CF_API = "https://api.cloudflare.com/client/v4"
ACCOUNT_ID = settings.CF_STREAM_ACCOUNT_ID
TOKEN = settings.CF_STREAM_API_TOKEN

def cf_headers():
    return {"Authorization": f"Bearer {TOKEN}"}

def _require_signed_default() -> bool:
    """Pilote requireSignedURLs via l'env (0/1)."""
    try:
        return bool(int(getattr(settings, "CF_STREAM_REQUIRE_SIGNED", 1)))
    except Exception:
        return True

def create_video_from_url(source_url: str, *, require_signed: bool | None = None, meta: dict | None = None):
    """
    Crée une vidéo dans Stream en copiant depuis une URL.
    Par défaut, on lit CF_STREAM_REQUIRE_SIGNED pour définir requireSignedURLs.
    """
    if require_signed is None:
        require_signed = _require_signed_default()

    url = f"{CF_API}/accounts/{ACCOUNT_ID}/stream/copy"
    payload = {
        "url": source_url,
        "requireSignedURLs": bool(require_signed),
        "meta": meta or {},
    }
    r = requests.post(url, headers=cf_headers(), json=payload, timeout=60)
    r.raise_for_status()
    return r.json()["result"]  # contient uid/playback/etc.

# ---------------------------
#  SIGNING: clé + URL HLS
# ---------------------------

def _load_signing_key_pem() -> bytes:
    """
    Charge la clé privée RSA depuis l'env, en étant tolérant:
    - Si commence par '-----BEGIN', on la prend telle quelle (PEM).
    - Sinon on tente base64.decode pour obtenir le PEM (ou DER).
    - On renvoie des bytes utilisables par PyJWT.
    """
    raw = getattr(settings, "CF_STREAM_SIGNING_KEY", "") or ""
    if not raw:
        raise RuntimeError("CF_STREAM_SIGNING_KEY manquante")

    # Si l'env contient déjà le PEM complet (avec BEGIN/END)
    if "BEGIN" in raw and "PRIVATE KEY" in raw:
        return raw.encode("utf-8")

    # Sinon on pense que c'est du base64 -> decode
    try:
        decoded = base64.b64decode(raw)
        return decoded  # PEM ou DER en bytes (PyJWT gère les deux)
    except Exception as e:
        raise RuntimeError("CF_STREAM_SIGNING_KEY invalid (base64)") from e

def _customer_domain() -> str:
    dom = getattr(settings, "CF_STREAM_CUSTOMER_DOMAIN", "").strip()
    if not dom:
        raise RuntimeError("CF_STREAM_CUSTOMER_DOMAIN manquant (ex: https://customer-xxxx.cloudflarestream.com)")
    if not dom.startswith("http"):
        dom = "https://" + dom
    return dom.rstrip("/")

def sign_playback_token(subject_uid: str, *, expire_s: int = 3600) -> str:
    """
    Génère un JWT RS256 pour Stream:
      - sub = UID Cloudflare de la vidéo (cf_uid)
      - exp = maintenant + expire_s
      - kid dans le HEADER, pas dans le payload
    """
    private_pem = _load_signing_key_pem()
    kid = getattr(settings, "CF_STREAM_SIGNING_KID", "").strip()
    if not kid:
        raise RuntimeError("CF_STREAM_SIGNING_KID manquant")

    now = int(time.time())
    payload = {
        "sub": subject_uid,
        "exp": now + int(expire_s),
        "nbf": now - 5,  # un léger skew
    }
    headers = {"kid": kid}

    token = jwt.encode(payload, private_pem, algorithm="RS256", headers=headers)
    return token if isinstance(token, str) else token.decode("utf-8")

def playback_hls_url(playback_id: str, token: str | None = None) -> str:
    """
    - Si token: on DOIT utiliser le domain 'customer-xxx.cloudflarestream.com' avec token-in-path.
    - Sinon: on peut utiliser videodelivery.net (public).
    """
    if token:
        base = _customer_domain()
        return f"{base}/{token}/manifest/video.m3u8"
    # public (si requireSignedURLs = false sur l'asset)
    return f"https://videodelivery.net/{playback_id}/manifest/video.m3u8"


# ---------------------------
#  Optionnel: changer requireSignedURLs d'une vidéo existante
# ---------------------------

def update_video_require_signed(uid: str, require_signed: bool) -> dict:
    """
    Permet de modifier requireSignedURLs d'un asset existant.
    Utile si tu veux passer de 'signé' à 'public' (ou inverse).
    """
    url = f"{CF_API}/accounts/{ACCOUNT_ID}/stream/{uid}"
    payload = {"requireSignedURLs": bool(require_signed)}
    r = requests.patch(url, headers=cf_headers(), json=payload, timeout=30)
    r.raise_for_status()
    return r.json()["result"]