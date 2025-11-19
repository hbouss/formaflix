from django.conf import settings
from django.contrib import admin, messages

from certificates.models import Certificate
from .models import Lesson, Document, Enrollment, Progress, Favorite
from .services.cloudflare_stream import create_direct_upload, create_from_url, get_asset, extract_playback_id, \
    upload_file_to_direct_upload, upload_local_file_smart


def _abs_media_url(request, f):
    # construit une URL absolue pour un FileField (utile pour /stream/copy)
    try:
        return request.build_absolute_uri(f.url)
    except Exception:
        return ""

@admin.register(Lesson)
class LessonAdmin(admin.ModelAdmin):
    list_display = ("course", "order", "title", "is_free_preview",
                    "duration_seconds", "cf_ready")
    list_filter = ("course", "is_free_preview", "cf_ready")
    ordering = ("course", "order")
    actions = ["make_stream_upload_link", "send_to_cloudflare_from_url", "upload_local_file_to_stream", "refresh_stream_status"]

    # --- ACTIONS ---

    @admin.action(description="Créer un 'direct upload' Cloudflare (copie le lien retourné)")
    def make_stream_upload_link(self, request, queryset):
        ok = 0
        for lesson in queryset:
            try:
                meta = {"kind": "lesson", "lesson_id": lesson.id, "course_id": lesson.course_id, "title": lesson.title}
                res = create_direct_upload(meta=meta)
                lesson.cf_uid = res["uid"]
                lesson.cf_ready = False
                lesson.save(update_fields=["cf_uid", "cf_ready"])
                messages.info(request, f"[{lesson}] uploadURL = {res['uploadURL'][:120]}... (UID={res['uid']})")
                ok += 1
            except Exception as e:
                messages.error(request, f"[{lesson}] échec: {e}")
        if ok:
            messages.success(request, f"{ok} upload(s) créé(s).")

    @admin.action(description="Envoyer vers Cloudflare (depuis video_url / fichier public)")
    def send_to_cloudflare_from_url(self, request, queryset):
        ok = 0
        for lesson in queryset:
            try:
                if lesson.cf_uid:
                    messages.warning(request, f"[{lesson}] déjà envoyé (uid={lesson.cf_uid}).")
                    continue
                src = lesson.video_url or (lesson.video_file and _abs_media_url(request, lesson.video_file)) or ""
                if not src:
                    messages.error(request, f"[{lesson}] aucune source (video_url ou fichier).")
                    continue
                if settings.DEBUG and ("127.0.0.1" in src or "localhost" in src):
                    messages.warning(request,
                                     f"[{lesson}] URL locale non joignable par Cloudflare — utilise l'action 'Uploader le fichier local → Stream'.")
                    continue
                res = create_from_url(src, meta={"kind": "lesson", "lesson_id": lesson.id}, require_signed=True)
                Lesson.objects.filter(pk=lesson.pk).update(cf_uid=res["uid"], cf_ready=False)
                ok += 1
            except Exception as e:
                messages.error(request, f"[{lesson}] échec envoi: {e}")
        if ok:
            messages.success(request, f"Ingestion démarrée pour {ok} leçon(s).")

    @admin.action(description="Uploader le fichier local → Cloudflare Stream (auto: Direct ou TUS)")
    def upload_local_file_to_stream(self, request, queryset):
        sent = 0
        for lesson in queryset:
            try:
                if not lesson.video_file:
                    messages.warning(request, f"[{lesson}] pas de 'video_file' local — rien à envoyer.")
                    continue
                if lesson.cf_uid:
                    messages.warning(request, f"[{lesson}] déjà envoyé (uid={lesson.cf_uid}).")
                    continue

                meta = {"kind": "lesson", "lesson_id": lesson.id, "course_id": lesson.course_id, "title": lesson.title}
                uid = upload_local_file_smart(lesson.video_file.path, meta=meta, require_signed=True)

                lesson.cf_uid = uid
                lesson.cf_ready = False
                lesson.save(update_fields=["cf_uid", "cf_ready"])
                messages.success(request, f"[{lesson}] envoyé vers Stream (UID={uid}).")
                sent += 1
            except Exception as e:
                messages.error(request, f"[{lesson}] envoi échoué: {e}")
        if sent:
            messages.success(request,
                             f"{sent} fichier(s) envoyés. Utilise 'Rafraîchir statut' lorsque l'encodage est terminé.")

    @admin.action(description="Rafraîchir statut Cloudflare")
    def refresh_stream_status(self, request, queryset):
        ok = 0
        for lesson in queryset:
            try:
                if not lesson.cf_uid:
                    continue
                asset = get_asset(lesson.cf_uid)
                pid = extract_playback_id(asset)
                ready = (asset.get("status", {}).get("state") == "ready")
                Lesson.objects.filter(pk=lesson.pk).update(
                    cf_playback_id=pid or lesson.cf_playback_id,
                    cf_ready=ready
                )
                ok += 1
            except Exception as e:
                messages.error(request, f"[{lesson}] refresh échec: {e}")
        if ok:
            messages.success(request, f"Statut mis à jour pour {ok} leçon(s).")

    # Auto-trigger existant : on le garde tel quel
    def save_model(self, request, obj, form, change):
        super().save_model(request, obj, form, change)
        if not obj.cf_uid and ("video_url" in form.changed_data or "video_file" in form.changed_data):
            src = obj.video_url or (obj.video_file and _abs_media_url(request, obj.video_file)) or ""
            if not src:
                return
            if settings.DEBUG and ("127.0.0.1" in src or "localhost" in src):
                messages.warning(request,
                                 f"[{obj}] Source locale non joignable par Cloudflare. Utilise l'action Direct upload.")
                return
            try:
                res = create_from_url(src, meta={"kind": "lesson", "lesson_id": obj.id}, require_signed=True)
                Lesson.objects.filter(pk=obj.pk).update(cf_uid=res["uid"], cf_ready=False)
                messages.success(request, f"Ingestion Cloudflare démarrée (uid={res['uid']}).")
            except Exception as e:
                messages.error(request, f"Echec envoi Cloudflare: {e}")

@admin.register(Document)
class DocumentAdmin(admin.ModelAdmin):
    list_display = ("course", "title", "file")

@admin.register(Enrollment)
class EnrollmentAdmin(admin.ModelAdmin):
    list_display = ("user", "course", "purchased_at", "access_expires_at")
    list_filter = ("course",)

@admin.register(Progress)
class ProgressAdmin(admin.ModelAdmin):
    list_display = ("enrollment", "lesson", "position_seconds", "completed", "updated_at")

@admin.register(Favorite)
class FavoriteAdmin(admin.ModelAdmin):
    list_display = ("user","course","created_at")
    search_fields = ("user__username","course__title")

@admin.register(Certificate)
class CertificateAdmin(admin.ModelAdmin):
    list_display = ("user","course","filename","created_at")
    search_fields = ("user__username","course__title","filename")