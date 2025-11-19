from django.contrib import admin, messages

from learning.services.cloudflare_stream import create_from_url
from .models import Course, Category
from learning.models import Lesson, Document

class LessonInline(admin.TabularInline):
    model = Lesson
    extra = 1
    ordering = ("order",)
    fields = (
        "order", "title",
        "video_file", "video_url",
        # ↓ suivi Stream
        "cf_uid", "cf_playback_id", "cf_ready",
        "duration_seconds", "is_free_preview",
    )
    readonly_fields = ("cf_uid", "cf_playback_id", "cf_ready")

class DocumentInline(admin.TabularInline):
    model = Document
    extra = 1

@admin.register(Course)
class CourseAdmin(admin.ModelAdmin):
    list_display = ("title", "price_cents", "currency", "is_active", "top10_rank", "is_editor_pick", "is_full_pack", "created_at")
    list_filter = ("is_active", "categories", "currency", "is_editor_pick", "is_full_pack")
    list_editable = ("top10_rank", "is_editor_pick", "is_full_pack")
    search_fields = ("title", "slug", "synopsis")
    prepopulated_fields = {"slug": ("title",)}
    fields = (
        "title","slug","synopsis","description",
        "thumbnail","hero_banner","trailer_file","trailer_url",
        "price_cents","currency","categories","is_active",
        # ↓ nouveaux champs Home
        "is_editor_pick","editor_pick_weight",
        "is_full_pack","pack_weight",
        "top10_rank",
    )
    inlines = [LessonInline, DocumentInline]

    def save_formset(self, request, form, formset, change):
        instances = formset.save()
        super().save_formset(request, form, formset, change)

        if formset.model is Lesson:
            created = 0
            for inst in instances:
                if inst.cf_uid:
                    continue
                src = inst.video_url or (inst.video_file and request.build_absolute_uri(inst.video_file.url)) or ""
                if not src:
                    continue
                try:
                    res = create_from_url(src, meta={"kind": "lesson", "lesson_id": inst.id}, require_signed=True)
                    Lesson.objects.filter(pk=inst.pk).update(cf_uid=res["uid"], cf_ready=False)
                    created += 1
                except Exception as e:
                    messages.error(request, f"[{inst}] envoi CF échec: {e}")
            if created:
                messages.success(request, f"Ingestion Cloudflare démarrée pour {created} leçon(s).")

@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ("name", "slug")
    prepopulated_fields = {"slug": ("name",)}