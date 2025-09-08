from django.shortcuts import get_object_or_404
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from catalog.models import Course
from .models import Enrollment, Favorite, Lesson, Progress, Document, DocumentDownload
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

        pos = max(0, ser.validated_data["position_seconds"])
        duration = ser.validated_data.get("duration_seconds")
        if duration is None or duration < 1:
            duration = max(pos, 1)  # fallback propre

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
            p_last = last_progress(e)               # dernier Progress (ta util)
            percent = compute_enrollment_percent(e) # % global (ta util)

            # ⛔️ pas de reprise si aucune progression
            if not p_last or (p_last.position_seconds or 0) <= 0:
                continue
            # ⛔️ pas de reprise si cours terminé
            if percent is not None and percent >= 100:
                continue

            items.append({
                "course": e.course,
                "percent": int(percent or 0),  # autorise 0–99
                "resume_lesson_id": getattr(p_last.lesson, "id", None),
                "resume_position_seconds": int(p_last.position_seconds or 0),
            })

        data = ContinueWatchingItemSerializer(items, many=True, context={"request": request}).data
        return Response(data)


class TrackDocumentDownloadView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    def post(self, request, doc_id: int):
        doc = get_object_or_404(Document, pk=doc_id)
        enrollment = Enrollment.objects.filter(user=request.user, course=doc.course).first()
        if not enrollment:
            return Response({"detail": "not enrolled"}, status=403)
        DocumentDownload.objects.create(enrollment=enrollment, document=doc)
        return Response({"ok": True})