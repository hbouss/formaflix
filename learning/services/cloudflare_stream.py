# learning/services/cloudflare_stream.py
import os, time, base64, json
import requests
import jwt
from tusclient import client as tus_client

CF_ACCOUNT_ID = os.getenv("CF_STREAM_ACCOUNT_ID", "")
CF_API_TOKEN  = os.getenv("CF_STREAM_API_TOKEN", "")

CF_SIGN_KID   = os.getenv("CF_STREAM_SIGNING_KID", "")
CF_SIGN_KEY_B64 = os.getenv("CF_STREAM_SIGNING_KEY", "")  # PEM base64 (ce qu'on a mis dans .env)

CF_MAX_DUR = int(os.getenv("CF_STREAM_MAX_DURATION_SECONDS", "0") or 0)  # <- NEW
CF_REQUIRE_SIGNED = (os.getenv("CF_STREAM_REQUIRE_SIGNED", "0").lower() in ("1","true","yes"))
CF_DIRECT_UPLOAD_MAX_MB = int(os.getenv("CF_STREAM_DIRECT_UPLOAD_MAX_MB", "180"))  # seuil pour POST direct
CF_TUS_CHUNK_MB = int(os.getenv("CF_STREAM_TUS_CHUNK_MB", "50"))                   # 50 Mo par chunk

API_BASE = f"https://api.cloudflare.com/client/v4/accounts/{CF_ACCOUNT_ID}/stream"

def _headers():
    return {
        "Authorization": f"Bearer {CF_API_TOKEN}",
        "Content-Type": "application/json",
    }

def _norm_meta(meta: dict | None) -> dict | None:
    if not meta:
        return None
    # Cloudflare: safer → toutes les valeurs en str, taille raisonnable
    out = {}
    for k, v in meta.items():
        ks = str(k)[:100]
        vs = str(v)[:500]
        out[ks] = vs
    return out


def create_direct_upload(meta: dict | None = None, require_signed: bool = False) -> dict:
    """
    NOTE: require_signed=False par défaut (aligne l'admin sur ton test shell).
    """
    payload = {
        "requireSignedURLs": bool(require_signed),
        "maxDurationSeconds": CF_MAX_DUR or 14400,
    }
    nm = _norm_meta(meta)
    if nm:
        payload["meta"] = nm

    r = requests.post(
        f"{API_BASE}/direct_upload",
        headers={"Authorization": f"Bearer {CF_API_TOKEN}"},
        json=payload,
        timeout=60,
    )
    if not r.ok:
        # expose la réponse brute pour diagnostiquer (évite "messages=None")
        raise RuntimeError(f"CF direct_upload failed {r.status_code}: {r.text}")

    res = r.json()["result"]
    return {"uploadURL": res["uploadURL"], "uid": res["uid"]}


def build_hls_url(playback_id: str, sign: bool = True, ttl_seconds: int = 3600) -> str:
    """
    Retourne l'URL HLS (m3u8). Si la signature est dispo, on ajoute ?token=...
    """
    base = f"https://videodelivery.net/{playback_id}/manifest/video.m3u8"
    if not sign:
        return base

    if not CF_SIGN_KID or not CF_SIGN_KEY_B64:
        return base  # pas de signature dispo → URL publique

    pem = base64.b64decode(CF_SIGN_KEY_B64)
    now = int(time.time())
    payload = {
        "sub": playback_id,               # identifie la ressource à lire
        "exp": now + ttl_seconds,         # expiration
        "accessRules": [ {"type": "any"} ]  # tu pourras raffiner (IP, pays, etc.)
    }
    headers = { "kid": CF_SIGN_KID }
    token = jwt.encode(payload, pem, algorithm="RS256", headers=headers)

    return f"{base}?token={token}"

def get_asset(uid: str) -> dict:
    """
    Récupère les infos d'un asset Stream par UID.
    """
    r = requests.get(f"{API_BASE}/{uid}", headers=_headers())
    r.raise_for_status()
    return r.json()["result"]

def delete_asset(uid: str) -> None:
    requests.delete(f"{API_BASE}/{uid}", headers=_headers()).raise_for_status()

def create_from_url(source_url: str, meta: dict | None = None, require_signed: bool = False) -> dict:
    payload = {
        "url": source_url,
        "requireSignedURLs": bool(require_signed),
    }
    nm = _norm_meta(meta)
    if nm:
        payload["meta"] = nm

    r = requests.post(
        f"{API_BASE}/copy",
        headers={"Authorization": f"Bearer {CF_API_TOKEN}"},
        json=payload,
        timeout=60,
    )
    if not r.ok:
        raise RuntimeError(f"CF copy failed {r.status_code}: {r.text}")
    return {"uid": r.json()["result"]["uid"]}

def upload_file_to_direct_upload(upload_url: str, file_path: str) -> None:
    import os, mimetypes
    mime = mimetypes.guess_type(file_path)[0] or "video/mp4"
    with open(file_path, "rb") as f:
        r = requests.post(upload_url, files={"file": (os.path.basename(file_path), f, mime)}, timeout=None)
    if r.status_code >= 400:
        raise RuntimeError(f"CF upload file failed {r.status_code}: {r.text}")

def extract_playback_id(asset: dict) -> str | None:
    """
    Plus robuste : Cloudflare renvoie souvent playback.hls = https://videodelivery.net/<ID>/manifest/video.m3u8
    On récupère l'ID à partir de cette URL.
    """
    pb = asset.get("playback") or {}
    hls = pb.get("hls") or ""
    if isinstance(hls, str) and "/manifest/video.m3u8" in hls:
        # .../<ID>/manifest/video.m3u8
        try:
            mid = hls.split("/manifest/")[0].rstrip("/").split("/")[-1]
            if mid:
                return mid
        except Exception:
            pass
    # fallback sur ton ancien comportement si jamais:
    pl = asset.get("playback") or []
    if isinstance(pl, list):
        for p in pl:
            pid = p.get("id") or p.get("uid") or p.get("playback_id")
            if pid:
                return pid
    return None


def _b64(s: str) -> str:
    return base64.b64encode(str(s).encode("utf-8")).decode("ascii")

def tus_upload_file(file_path: str, meta: dict | None = None, require_signed: bool = True) -> str:
    """
    Lance un upload TUS (recommandé >200 Mo).
    Retourne un 'uid' Cloudflare déduit de l'URL d'upload.
    """
    meta = meta or {}
    # tuspy encode les valeurs de metadata en base64 pour nous.
    tus_metadata = {
        "name": meta.get("title") or os.path.basename(file_path),
        "maxDurationSeconds": str(CF_MAX_DUR or 14400),
    }
    if require_signed:
        tus_metadata["requireSignedURLs"] = "true"

    # Endpoint de création TUS = API_BASE (sans /direct_upload)
    headers = {"Authorization": f"Bearer {CF_API_TOKEN}"}
    client = tus_client.TusClient(API_BASE, headers=headers)

    uploader = client.uploader(
        file_path=file_path,
        chunk_size=CF_TUS_CHUNK_MB * 1024 * 1024,
        metadata=tus_metadata,
        retries=5,
        retry_delay=5,
    )
    uploader.upload()  # envoie les chunks jusqu'au bout

    # uploader.url est l'URL 'Location' renvoyée par Cloudflare (tus)
    # Son dernier segment correspond généralement à l'UID de la vidéo.
    loc = (uploader.url or "").rstrip("/")
    uid = loc.split("/")[-1] if loc else ""
    if not uid:
        raise RuntimeError("TUS upload terminé mais impossible de déduire l'UID depuis l'URL de location.")
    return uid

def upload_local_file_smart(file_path: str, meta: dict | None = None, require_signed: bool = True) -> str:
    """
    Choisit automatiquement: direct upload (≤~180 Mo) ou TUS (>180 Mo).
    Retourne l'UID.
    """
    size_mb = os.path.getsize(file_path) / (1024 * 1024)
    if size_mb <= CF_DIRECT_UPLOAD_MAX_MB:
        # chemin déjà présent chez toi
        du = create_direct_upload(meta=meta, require_signed=require_signed)
        upload_file_to_direct_upload(du["uploadURL"], file_path)
        return du["uid"]
    else:
        return tus_upload_file(file_path, meta=meta, require_signed=require_signed)

