from django.contrib import admin
from .models import Course, Category
from learning.models import Lesson, Document

class LessonInline(admin.TabularInline):
    model = Lesson
    extra = 1
    ordering = ("order",)
    fields = ("order", "title", "video_file", "video_url", "duration_seconds", "is_free_preview")

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

@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ("name", "slug")
    prepopulated_fields = {"slug": ("name",)}