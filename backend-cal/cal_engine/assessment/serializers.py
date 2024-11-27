from rest_framework import serializers
from .models import Assessment, Question, QuestionOption, AssessmentGrading

class AssessmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Assessment
        fields = '__all__'

class QuestionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Question
        fields = '__all__'

class QuestionOptionSerializer(serializers.ModelSerializer):
    class Meta:
        model = QuestionOption
        fields = '__all__'

class AssessmentGradingSerializer(serializers.ModelSerializer):
    class Meta:
        model = AssessmentGrading
        fields = '__all__'
