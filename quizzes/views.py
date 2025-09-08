from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from django.shortcuts import get_object_or_404

from learning.utils import compute_enrollment_percent
from .models import Quiz, Question, Choice, Submission
from .serializers import QuizDetailSerializer, QuizSubmitSerializer, SubmissionSerializer
from learning.models import Enrollment, DocumentDownload

RETAKE_PROGRESS_DELTA = 10  # exiger +10 points de progression vs dernier échec

class QuizDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    def get(self, request, course_id: int):
        # Accès réservé aux inscrits (acheteurs)
        if not Enrollment.objects.filter(user=request.user, course_id=course_id).exists():
            return Response({"detail": "not enrolled"}, status=403)
        quiz = get_object_or_404(Quiz, course_id=course_id)
        return Response(QuizDetailSerializer(quiz).data)

class QuizSubmitView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    def post(self, request, course_id: int):
        enrollment = Enrollment.objects.filter(user=request.user, course_id=course_id).first()
        if not enrollment:
            return Response({"detail":"not enrolled"}, status=403)

        quiz = get_object_or_404(Quiz, course_id=course_id)
        ser = QuizSubmitSerializer(data=request.data); ser.is_valid(raise_exception=True)
        answers = ser.validated_data["answers"]

        # 🔒 Blocage re-take: si la DERNIÈRE soumission est un échec,
        # exiger soit +10 points de progression depuis cet échec, soit un téléchargement de document après l’échec.
        last_sub = Submission.objects.filter(user=request.user, quiz=quiz).order_by("-submitted_at").first()
        current_percent = compute_enrollment_percent(enrollment)

        if last_sub and not last_sub.passed:
            # a) a-t-il téléchargé un doc après l'échec ?
            has_download_after_fail = DocumentDownload.objects.filter(
                enrollment=enrollment, downloaded_at__gt=last_sub.submitted_at
            ).exists()
            # b) a-t-il augmenté sa progression ?
            has_progress_increase = current_percent >= min(100, last_sub.progress_percent + RETAKE_PROGRESS_DELTA)

            if not (has_download_after_fail or has_progress_increase):
                return Response({
                    "detail": "Retake blocked",
                    "reason": "Please rewatch the course (increase your progress) or download a document before retrying the quiz.",
                    "needed_progress_at_least": min(100, last_sub.progress_percent + RETAKE_PROGRESS_DELTA),
                    "your_current_progress": current_percent,
                    "since_failed_at": last_sub.submitted_at,
                }, status=409)

        # Corriger / noter
        total = quiz.questions.count() or 1
        correct = 0
        for q in quiz.questions.all():
            choice_id = answers.get(str(q.id)) or answers.get(int(q.id))
            if choice_id and Choice.objects.filter(id=choice_id, question=q, is_correct=True).exists():
                correct += 1
        score = int(round(100 * correct / total))
        passed = score >= quiz.passing_score

        sub = Submission.objects.create(
            user=request.user, quiz=quiz,
            score_percent=score, passed=passed,
            progress_percent=current_percent,  # 👈 snapshot
        )
        return Response(SubmissionSerializer(sub).data, status=201)