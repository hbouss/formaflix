from rest_framework import serializers
from .models import Enrollment
from catalog.serializers import CourseListSerializer

class MyLibraryItemSerializer(serializers.ModelSerializer):
    course = CourseListSerializer(read_only=True)
    class Meta:
        model = Enrollment
        fields = ["id","purchased_at","course"]