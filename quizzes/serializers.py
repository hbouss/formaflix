from rest_framework import serializers
from .models import Quiz, Question, Choice, Submission

class ChoiceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Choice
        fields = ["id","text"]

class QuestionSerializer(serializers.ModelSerializer):
    choices = ChoiceSerializer(many=True, read_only=True)
    class Meta:
        model = Question
        fields = ["id","text","choices"]

class QuizDetailSerializer(serializers.ModelSerializer):
    questions = QuestionSerializer(many=True, read_only=True)
    class Meta:
        model = Quiz
        fields = ["id","title","passing_score","questions"]

class QuizSubmitSerializer(serializers.Serializer):
    answers = serializers.DictField(child=serializers.IntegerField())
    # answers: { "<question_id>": <choice_id>, ... }

class SubmissionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Submission
        fields = ["id","score_percent","passed","submitted_at"]