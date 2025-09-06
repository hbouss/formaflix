from rest_framework import viewsets, permissions
from .models import Course
from .serializers import CourseListSerializer, CourseDetailSerializer

class CourseViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Course.objects.filter(is_active=True).order_by("-created_at")
    permission_classes = [permissions.AllowAny]

    def get_serializer_class(self):
        return CourseDetailSerializer if self.action == "retrieve" else CourseListSerializer