# learning/views_cf.py
import json
from django.conf import settings
from django.http import HttpResponse, JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST
from .models import Lesson

def _extract_playback_id_from_playback(playback):
    """
    Cloudflare peut renvoyer:
      - playback = {"hls": "https://videodelivery.net/<ID>/manifest/video.m3u8", ...}
      - ou playback = {"id": "<ID>"} / {"uid": "<ID>"} / {"playbackId": "<ID>"}
    """
    if not isinstance(playback, dict):
        return None
    # hls complet → extraire l'ID
    hls = playback.get("hls")
    if isinstance(hls, str) and "/manifest/video.m3u8" in hls:
        try:
            return hls.split("/manifest/")[0].rstrip("/").split("/")[-1]
        except Exception:
            pass
    # champs directs
    return playback.get("id") or playback.get("uid") or playback.get("playbackId")

def _coalesce_payload(payload):
    """
    Normalise le payload pour retourner:
      uid, ready(bool), playback_id(str|None), duration_sec(int|0), meta(dict)
    Compatible avec:
      A) {"uid": "...", "status":{"state":"ready"}, "meta":{...}, "playback":{...}}
      B) {"type":"video.ready", "video":{ "uid": "...", "playback":{...}, "duration": ... , "meta":{...}}}
    """
    uid = None
    ready = False
    playback_id = None
    duration_sec = 0
    meta = {}

    # Format A (root-level)
    status = payload.get("status") or {}
    if "uid" in payload:
        uid = payload.get("uid")
        state = (status or {}).get("state")
        ready = (state == "ready")
        meta = payload.get("meta") or {}
        playback_id = _extract_playback_id_from_playback(payload.get("playback") or {})
        # Durée éventuelle au root (plus rare)
        dur = payload.get("duration")
        if dur:
            try:
                duration_sec = int(round(float(dur)))
            except Exception:
                pass

    # Format B (event type)
    if not uid and ("type" in payload or "video" in payload or "data" in payload):
        evt_type = payload.get("type") or ""
        v = (payload.get("video") or {}) or (payload.get("data") or {})  # parfois "data"
        uid = v.get("uid") or v.get("id") or uid
        ready = ready or (evt_type == "video.ready")
        meta = v.get("meta") or meta
        playback_id = playback_id or _extract_playback_id_from_playback(v.get("playback") or {})
        dur = v.get("duration")
        if dur and not duration_sec:
            try:
                duration_sec = int(round(float(dur)))
            except Exception:
                pass

    return uid, ready, playback_id, duration_sec, meta

@csrf_exempt
@require_POST
def cf_stream_webhook(request, secret):
    payload = json.loads(request.body.decode("utf-8") or "{}")

    # Normalisation du format Cloudflare
    event = payload.get("type")
    v = payload.get("video") or payload.get("data") or {}
    # Certains anciens formats : { "uid": "...", "status": {"state": "ready"} }
    if not v and "uid" in payload and payload.get("status", {}).get("state") == "ready":
        v = payload
        event = event or "video.ready"

    if event == "video.ready" and v:
        uid = (v.get("uid") or "").split("?", 1)[0]

        # playback peut être: {"id": "..."} ou {"hls": {"id": "..."}}
        playback = v.get("playback") or {}
        if isinstance(playback, dict) and "hls" in playback and isinstance(playback["hls"], dict):
            playback_id = playback["hls"].get("id")
        else:
            playback_id = playback.get("id") or v.get("playbackId")

        # trouver la leçon : par uid (et à défaut via meta.lesson_id si fourni)
        lesson = Lesson.objects.filter(cf_uid=uid).first()
        if not lesson:
            meta = v.get("meta") or {}
            lesson_id = meta.get("lesson_id")
            if lesson_id:
                lesson = Lesson.objects.filter(pk=lesson_id).first()

        if lesson:
            # durée
            dur = int(round(float(v.get("duration", 0)))) if v.get("duration") else lesson.duration_seconds

            lesson.cf_ready = True
            # ⚠️ On met à jour le playback_id si Cloudflare nous en donne un (même s’il y a déjà une valeur)
            if playback_id:
                lesson.cf_playback_id = playback_id
            if dur and dur > 0:
                lesson.duration_seconds = dur

            lesson.save(update_fields=["cf_ready", "cf_playback_id", "duration_seconds"])
            return JsonResponse({"ok": True, "updated": lesson.id})

        return JsonResponse({"ok": True, "note": "lesson not found for uid/meta"}, status=200)

    return HttpResponse(status=204)