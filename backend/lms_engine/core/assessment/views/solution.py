# core/assessment/views/solution.py

from drf_spectacular.utils import extend_schema
from rest_framework import status, viewsets
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet, ReadOnlyModelViewSet

from ..models import (DescriptiveSolution, MCQSolution, MSQSolution,
                      NATSolution, Question, QuestionOption)
from ..serializers import (DescriptiveSolutionSerializer,
                           MCQSolutionSerializer, MSQSolutionSerializer,
                           NATSolutionSerializer, QuestionOptionSerializer,
                           SolutionResponseSerializer)


@extend_schema(
    tags=["Solution"],
    operation_id="get_solution_by_question",
    description="Retrieve the solution for a specific question by its ID.",
    responses={
        200: SolutionResponseSerializer,
        404: {"description": "Question not found or solution not available."},
    },
    summary="Get Solution by Question",
)
@api_view(["GET"])
def get_solution_by_question(request, question_id):
    try:
        question = Question.objects.get(id=question_id)
    except Question.DoesNotExist:
        return Response(
            {"error": "Question not found"}, status=status.HTTP_404_NOT_FOUND
        )

    serializer = SolutionResponseSerializer(
        {
            "question": question,
            "question_type": question.type,
        }
    )

    solution_data = serializer.data.get("solution")

    if not solution_data:
        return Response(
            {"error": "Solution not found for the given question"},
            status=status.HTTP_404_NOT_FOUND,
        )

    return Response(serializer.data, status=status.HTTP_200_OK)


@extend_schema(
    tags=["Assessments"],
)
class QuestionOptionViewSet(viewsets.ModelViewSet):
    queryset = QuestionOption.objects.all()
    serializer_class = QuestionOptionSerializer


class NATSolutionViewSet(ReadOnlyModelViewSet):
    queryset = NATSolution.objects.all()
    serializer_class = NATSolutionSerializer


class DescriptiveSolutionViewSet(ReadOnlyModelViewSet):
    queryset = DescriptiveSolution.objects.all()
    serializer_class = DescriptiveSolutionSerializer
