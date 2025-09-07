from django.shortcuts import get_object_or_404
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from catalog.models import Course
from .models import Enrollment, Favorite, Lesson, Progress
from .serializers import MyLibraryItemSerializer, FavoriteSerializer, ProgressUpsertSerializer, \
    ContinueWatchingItemSerializer
from .utils import last_progress, compute_enrollment_percent


class MyLibraryView(generics.ListAPIView):
    serializer_class = MyLibraryItemSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Enrollment.objects.filter(user=self.request.user).select_related("course")

class MyListView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        favs = Favorite.objects.filter(user=request.user).select_related("course").order_by("-created_at")
        data = FavoriteSerializer(favs, many=True, context={"request": request}).data
        return Response(data)

    def post(self, request):
        course_id = request.data.get("course_id")
        course = get_object_or_404(Course, pk=course_id, is_active=True)
        Favorite.objects.get_or_create(user=request.user, course=course)
        return Response({"ok": True}, status=status.HTTP_201_CREATED)

    def delete(self, request):
        course_id = request.data.get("course_id")
        if not course_id:
            return Response({"detail": "course_id required"}, status=400)
        Favorite.objects.filter(user=request.user, course_id=course_id).delete()
        return Response({"ok": True})

class ProgressUpsertView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def patch(self, request):
        ser = ProgressUpsertSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        course_id = ser.validated_data["course_id"]
        lesson_id = ser.validated_data["lesson_id"]
        pos = ser.validated_data["position_seconds"]
        duration = ser.validated_data.get("duration_seconds")
        completed = ser.validated_data.get("completed", False)

        # doit être inscrit
        enrollment = Enrollment.objects.filter(user=request.user, course_id=course_id).first()
        if not enrollment:
            return Response({"detail": "not enrolled"}, status=403)

        lesson = get_object_or_404(Lesson, pk=lesson_id, course_id=course_id)

        if duration is not None and (lesson.duration_seconds or 0) < duration:
            lesson.duration_seconds = duration
            lesson.save(update_fields=["duration_seconds"])

        prog, _ = Progress.objects.get_or_create(enrollment=enrollment, lesson=lesson)
        prog.position_seconds = max(prog.position_seconds or 0, pos)
        if completed:
            prog.completed = True
        prog.save()
        return Response({"ok": True})

class ContinueWatchingView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        enrolls = (Enrollment.objects
                   .filter(user=request.user)
                   .select_related("course"))
        items = []
        for e in enrolls:
            p_last = last_progress(e)
            percent = compute_enrollment_percent(e)
            if percent <= 0 or percent >= 100:
                continue
            items.append({
                "course": e.course,
                "percent": percent,
                "resume_lesson_id": getattr(p_last.lesson, "id", None) if p_last else None,
                "resume_position_seconds": getattr(p_last, "position_seconds", 0) if p_last else 0,
            })
        # sérialise
        data = ContinueWatchingItemSerializer(items, many=True, context={"request": request}).data
        return Response(data)