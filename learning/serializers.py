from rest_framework import serializers
from .models import Enrollment, Favorite
from catalog.serializers import CourseListSerializer

class MyLibraryItemSerializer(serializers.ModelSerializer):
    course = CourseListSerializer(read_only=True)
    class Meta:
        model = Enrollment
        fields = ["id","purchased_at","course"]



class FavoriteSerializer(serializers.ModelSerializer):
    course = CourseListSerializer(read_only=True)
    class Meta:
        model = Favorite
        fields = ["id","course","created_at"]

class ProgressUpsertSerializer(serializers.Serializer):
    course_id = serializers.IntegerField()
    lesson_id = serializers.IntegerField()
    position_seconds = serializers.IntegerField(min_value=0)
    duration_seconds = serializers.IntegerField(min_value=0, required=False)
    completed = serializers.BooleanField(required=False, default=False)

class ContinueWatchingItemSerializer(serializers.Serializer):
    course = CourseListSerializer()
    percent = serializers.IntegerField()
    resume_lesson_id = serializers.IntegerField(allow_null=True)
    resume_position_seconds = serializers.IntegerField(default=0)