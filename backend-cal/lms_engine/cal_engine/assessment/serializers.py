from rest_framework import serializers
from .models import Assessment, Question, ChoiceSolution

class AssessmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Assessment
        fields = '__all__'

class QuestionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Question
        fields = '__all__'

class ChoiceSolutionSerializer(serializers.ModelSerializer):
    class Meta:
        model = ChoiceSolution
        fields = '__all__'

