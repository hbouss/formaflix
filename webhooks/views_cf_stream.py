# webhooks/views_cf_stream.py
import json
from django.http import HttpResponse, HttpResponseForbidden, HttpResponseBadRequest
from django.views.decorators.csrf import csrf_exempt
from django.conf import settings
from learning.models import Lesson
from learning.services.cloudflare_stream import get_asset, extract_playback_id

@csrf_exempt
def cf_stream_webhook(request, secret: str):
    # Sécurité simple par secret dans l’URL
    if secret != getattr(settings, "CF_STREAM_WEBHOOK_SECRET", ""):
        return HttpResponseForbidden("bad secret")

    if request.method != "POST":
        return HttpResponseBadRequest("POST only")

    try:
        data = json.loads(request.body.decode("utf-8") or "{}")
    except Exception:
        return HttpResponseBadRequest("invalid json")

    # Récupère l'UID de la vidéo quel que soit le format
    uid = (data.get("uid") or data.get("id") or
           (data.get("video") or {}).get("uid") or
           (data.get("video") or {}).get("id"))
    if not uid:
        return HttpResponse("no uid", status=200)  # on ignore poliment

    # Va chercher l’asset à jour et met à jour notre DB
    asset = get_asset(uid)
    playback_id = extract_playback_id(asset)
    ready = (asset.get("status", {}).get("state") == "ready")

    Lesson.objects.filter(cf_uid=uid).update(
        cf_playback_id=playback_id or "",
        cf_ready=ready
    )
    return HttpResponse("ok")