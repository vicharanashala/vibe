# core/assessment/serializers.py
from django.core.exceptions import ValidationError
from django.db import transaction
from drf_spectacular.utils import extend_schema_field, extend_schema_serializer
from rest_framework import serializers

from ..course.models import SectionItemInfo, SectionItemType
from .models import (Assessment, DescriptiveSolution, MCQSolution, MSQSolution,
                     NATSolution, Question, QuestionOption, QuestionType)


class AssessmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Assessment
        exclude = ("created_at", "updated_at")


class QuestionOptionSerializer(serializers.ModelSerializer):
    class Meta:
        model = QuestionOption
        exclude = ["question"]


@extend_schema_serializer(
    examples=[
        {
            "value": 1,
            "tolerance_max": 0.5,
            "tolerance_min": 0.5,
            "decimal_precision": 2,
            "solution_explaination": 1,
        }
    ]
)
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


class SolutionResponseSerializer(serializers.Serializer):
    question_type = serializers.ChoiceField(
        choices=[qt[0] for qt in QuestionType.choices]
    )
    solution = serializers.SerializerMethodField()

    @extend_schema_field(
        {
            "oneOf": [
                {"$ref": "#/components/schemas/NATSolution"},
                {"$ref": "#/components/schemas/DescriptiveSolution"},
                {"$ref": "#/components/schemas/MCQSolution"},
                {"$ref": "#/components/schemas/MSQSolution"},
            ]
        }
    )
    def get_solution(self, obj):
        question = obj.get("question")
        question_type = question.type

        if question_type == QuestionType.NAT:
            if hasattr(question, "natsolution"):
                return NATSolutionSerializer(question.natsolution).data
        elif question_type == QuestionType.DESC:
            if hasattr(question, "descriptivesolution"):
                return DescriptiveSolutionSerializer(question.descriptivesolution).data
        elif question_type == QuestionType.MCQ:
            if hasattr(question, "mcqsolution"):
                return MCQSolutionSerializer(question.mcqsolution).data
        elif question_type == QuestionType.MSQ:
            return MSQSolutionSerializer(
                MSQSolution.objects.filter(question=question), many=True
            ).data
        return None


class QuestionSerializer(serializers.ModelSerializer):
    options = QuestionOptionSerializer(many=True, required=False)
    nat_solution = NATSolutionSerializer(required=False)
    descriptive_solution = DescriptiveSolutionSerializer(required=False)
    solution_option_index = serializers.IntegerField(required=False)
    solution_options_indices = serializers.ListField(
        child=serializers.IntegerField(), required=False
    )

    class Meta:
        model = Question
        fields = [
            "id",
            "text",
            "hint",
            "type",
            "partial_marking",
            "marks",
            "assessment",
            "options",
            "nat_solution",
            "descriptive_solution",
            "solution_option_index",
            "solution_options_indices",
        ]

    def validate(self, data):
        question_type = data.get("type")
        if question_type == QuestionType.MCQ:
            if "options" not in data or "solution_option_index" not in data:
                raise ValidationError(
                    "MCQ questions require 'options' and a single 'solution_option'."
                )
        elif question_type == QuestionType.MSQ:
            if "options" not in data or "solution_options_indices" not in data:
                raise ValidationError(
                    "MSQ questions require 'options' and 'solution_options'."
                )
        elif question_type == QuestionType.NAT:
            if "nat_solution" not in data:
                raise ValidationError("NAT questions require 'nat_solution'.")
        elif question_type == QuestionType.DESC:
            if "descriptive_solution" not in data:
                raise ValidationError(
                    "Descriptive questions require 'descriptive_solution'."
                )
        return data

    def create(self, validated_data):
        options = validated_data.pop("options", None)
        nat_solution = validated_data.pop("nat_solution", None)
        descriptive_solution = validated_data.pop("descriptive_solution", None)
        solution_option_index = validated_data.pop("solution_option_index", None)
        solution_options_indices = validated_data.pop("solution_options_indices", None)

        with transaction.atomic():
            question = super().create(validated_data)

            if options:
                created_option_id = []

                for option in options:
                    current_option = QuestionOption.objects.create(
                        question=question, **option
                    )
                    created_option_id.append(current_option.id)

            if nat_solution is not None:
                NATSolution.objects.create(question=question, **nat_solution)

            if descriptive_solution:
                DescriptiveSolution.objects.create(
                    question=question, **descriptive_solution
                )

            if solution_option_index is not None:
                choice = QuestionOption.objects.get(
                    id=created_option_id[solution_option_index]
                )
                MCQSolution.objects.create(question=question, choice=choice)

            if solution_options_indices:
                for solution_option_index in solution_options_indices:
                    choice = QuestionOption.objects.get(
                        id=created_option_id[solution_option_index]
                    )
                    MSQSolution.objects.create(question=question, choice=choice)

        return question
