from rest_framework import viewsets
from .models import Assessment, Question, QuestionOption, AssessmentGrading
from .serializers import AssessmentSerializer, QuestionSerializer, QuestionOptionSerializer, AssessmentGradingSerializer

class AssessmentViewSet(viewsets.ModelViewSet):
    queryset = Assessment.objects.all()
    serializer_class = AssessmentSerializer

class QuestionViewSet(viewsets.ModelViewSet):
    queryset = Question.objects.all()
    serializer_class = QuestionSerializer

class QuestionOptionViewSet(viewsets.ModelViewSet):
    queryset = QuestionOption.objects.all()
    serializer_class = QuestionOptionSerializer

class AssessmentGradingViewSet(viewsets.ModelViewSet):
    queryset = AssessmentGrading.objects.all()
    serializer_class = AssessmentGradingSerializer

