from rest_framework import serializers

from learning.models import Lesson, Document
from .models import Course


class LessonSerializer(serializers.ModelSerializer):
    video_src = serializers.SerializerMethodField()

    def get_video_src(self, obj):
        request = self.context.get("request")
        if obj.video_file:
            url = obj.video_file.url
            return request.build_absolute_uri(url) if request else url
        return obj.video_url or ""

    class Meta:
        model = Lesson
        fields = ["id","title","order","duration_seconds","is_free_preview","video_src"]

class DocumentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Document
        fields = ["id","title","file"]

class CourseListSerializer(serializers.ModelSerializer):
    categories = serializers.SlugRelatedField(slug_field="slug", many=True, read_only=True)
    trailer_src = serializers.SerializerMethodField()

    def get_trailer_src(self, obj):
        request = self.context.get("request")
        if obj.trailer_file:
            url = obj.trailer_file.url
            return request.build_absolute_uri(url) if request else url
        return obj.trailer_url or ""

    class Meta:
        model = Course
        fields = ["id","title","slug","synopsis","thumbnail","trailer_src","price_cents","currency","categories"]

class CourseDetailSerializer(serializers.ModelSerializer):
    categories = serializers.SlugRelatedField(slug_field="slug", many=True, read_only=True)
    lessons = LessonSerializer(many=True, read_only=True)
    documents = DocumentSerializer(many=True, read_only=True)
    trailer_src = serializers.SerializerMethodField()

    def get_trailer_src(self, obj):
        request = self.context.get("request")
        if obj.trailer_file:
            url = obj.trailer_file.url
            return request.build_absolute_uri(url) if request else url
        return obj.trailer_url or ""

    class Meta:
        model = Course
        fields = ["id","title","slug","synopsis","description","thumbnail","hero_banner",
                  "trailer_src","price_cents","currency","categories","lessons","documents"]