from rest_framework import serializers
from .models import StudySession, SessionViolation, ChapterCompletion

class StudySessionSerializer(serializers.ModelSerializer):
    class Meta:
        model = StudySession
        fields = '__all__'

class SessionViolationSerializer(serializers.ModelSerializer):
    class Meta:
        model = SessionViolation
        fields = '__all__'

class ChapterCompletionSerializer(serializers.ModelSerializer):
    class Meta:
        model = ChapterCompletion
        fields = '__all__'
