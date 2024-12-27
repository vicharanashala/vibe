from rest_framework import serializers

from .models import (
    Question,
    NATSolution,
    DescriptiveSolution,
    MCQSolution,
    MSQSolution,
    Assessment,
    QuestionOption,
)


class AssessmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Assessment
        fields = "__all__"


class QuestionOptionSerializer(serializers.ModelSerializer):
    class Meta:
        model = QuestionOption
        fields = "__all__"


class QuestionSerializer(serializers.ModelSerializer):
    options = serializers.SerializerMethodField()

    class Meta:
        model = Question
        fields = "__all__"

    def get_options(self, obj):
        if obj.type in ["MCQ", "MSQ"]:
            return QuestionOptionSerializer(obj.options, many=True).data


class NATSolutionSerializer(serializers.ModelSerializer):
    class Meta:
        model = NATSolution
        fields = [
            "value",
            "tolerance_max",
            "tolerance_min",
            "decimal_precision",
            "solution_explanation",
        ]


class DescriptiveSolutionSerializer(serializers.ModelSerializer):
    class Meta:
        model = DescriptiveSolution
        fields = [
            "model_solution",
            "max_word_limit",
            "min_word_limit",
            "solution_explanation",
        ]


class MCQSolutionSerializer(serializers.ModelSerializer):
    choice = serializers.StringRelatedField()

    class Meta:
        model = MCQSolution
        fields = ["choice", "solution_explanation"]


class MSQSolutionSerializer(serializers.ModelSerializer):
    choice = serializers.StringRelatedField()

    class Meta:
        model = MSQSolution
        fields = ["choice", "solution_explanation"]
