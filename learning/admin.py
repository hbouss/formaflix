from django.contrib import admin

from certificates.models import Certificate
from .models import Lesson, Document, Enrollment, Progress, Favorite


@admin.register(Lesson)
class LessonAdmin(admin.ModelAdmin):
    list_display = ("course", "order", "title", "is_free_preview", "duration_seconds")
    list_filter = ("course", "is_free_preview")
    ordering = ("course", "order")

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