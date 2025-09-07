from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from django.shortcuts import get_object_or_404
from .models import Quiz, Question, Choice, Submission
from .serializers import QuizDetailSerializer, QuizSubmitSerializer, SubmissionSerializer
from learning.models import Enrollment

class QuizDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, course_id: int):
        # ✅ Exige avoir acheté le cours
        if not Enrollment.objects.filter(user=request.user, course_id=course_id).exists():
            return Response({"detail": "not enrolled"}, status=403)
        quiz = get_object_or_404(Quiz, course_id=course_id)
        return Response(QuizDetailSerializer(quiz).data)

class QuizSubmitView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    def post(self, request, course_id: int):
        # doit être inscrit au cours
        if not Enrollment.objects.filter(user=request.user, course_id=course_id).exists():
            return Response({"detail":"not enrolled"}, status=403)
        quiz = get_object_or_404(Quiz, course_id=course_id)
        ser = QuizSubmitSerializer(data=request.data); ser.is_valid(raise_exception=True)
        answers = ser.validated_data["answers"]
        total = quiz.questions.count() or 1
        correct = 0
        for q in quiz.questions.all():
            choice_id = answers.get(str(q.id)) or answers.get(int(q.id))  # str ou int
            if choice_id and Choice.objects.filter(id=choice_id, question=q, is_correct=True).exists():
                correct += 1
        score = int(round(100 * correct / total))
        passed = score >= quiz.passing_score
        sub = Submission.objects.create(user=request.user, quiz=quiz, score_percent=score, passed=passed)
        return Response(SubmissionSerializer(sub).data, status=201)