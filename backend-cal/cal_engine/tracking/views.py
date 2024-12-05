from rest_framework import viewsets
from .models import StudySession, SessionViolation, ChapterCompletion
from .serializers import StudySessionSerializer, SessionViolationSerializer, ChapterCompletionSerializer

class StudySessionViewSet(viewsets.ModelViewSet):
    queryset = StudySession.objects.all()
    serializer_class = StudySessionSerializer

class SessionViolationViewSet(viewsets.ModelViewSet):
    queryset = SessionViolation.objects.all()
    serializer_class = SessionViolationSerializer

class ChapterCompletionViewSet(viewsets.ModelViewSet):
    queryset = ChapterCompletion.objects.all()
    serializer_class = ChapterCompletionSerializer
