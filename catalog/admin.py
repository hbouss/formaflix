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
    list_display = ("title", "price_cents", "currency", "is_active", "created_at")
    list_filter = ("is_active", "categories", "currency")
    search_fields = ("title", "slug", "synopsis")
    prepopulated_fields = {"slug": ("title",)}
    # 👉 s'assurer que le champ apparait dans le formulaire
    fields = ("title","slug","synopsis","description","thumbnail","hero_banner","trailer_file","trailer_url",
              "price_cents","currency","categories","is_active")
    inlines = [LessonInline, DocumentInline]

@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ("name", "slug")
    prepopulated_fields = {"slug": ("name",)}