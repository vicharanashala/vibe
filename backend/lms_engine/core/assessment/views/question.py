# core/assessment/views/question.py

from drf_spectacular.utils import (OpenApiParameter, extend_schema,
                                   extend_schema_view)
from rest_framework import viewsets
from rest_framework.exceptions import NotFound

from ..models import Question
from ..serializers import QuestionSerializer


@extend_schema_view(
    list=extend_schema(
        tags=["Question"],
        summary="List Questions",
        description="Retrieve a list of questions filtered by `assessment_id`.",
        parameters=[
            OpenApiParameter(
                name="assessment_id",
                description="Filter questions by StandAlone Assessment ID.",
                required=False,
                type=int,
            ),
        ],
        responses={
            200: QuestionSerializer(many=True),
            404: {"description": "Not Found"},
        },
    ),
    retrieve=extend_schema(
        tags=["Question"],
        summary="Retrieve a Question",
        description="Retrieve detailed information for a specific question.",
        responses=QuestionSerializer,
    ),
    create=extend_schema(
        tags=["Question"],
        summary="Create a Question",
        description="Create a new question for an assessment.",
        request=QuestionSerializer,
        responses=QuestionSerializer,
    ),
    update=extend_schema(
        tags=["Question"],
        summary="Update a Question",
        description="Update an existing question by ID.",
        request=QuestionSerializer,
        responses=QuestionSerializer,
    ),
    partial_update=extend_schema(
        tags=["Question"],
        summary="Partially Update a Question",
        description="Update selected fields of an existing question.",
        request=QuestionSerializer,
        responses=QuestionSerializer,
    ),
    destroy=extend_schema(
        tags=["Question"],
        summary="Delete a Question",
        description="Delete an existing question by ID.",
        responses={"204": "Question deleted successfully."},
    ),
)
class QuestionViewSet(viewsets.ModelViewSet):
    """
    A ViewSet for managing Questions.
    """

    queryset = Question.objects.all()
    serializer_class = QuestionSerializer

    def list(self, request, *args, **kwargs):
        """
        Retrieve a list of questions based on `assessment_id`.
        """
        assessment_id = self.request.query_params.get("assessment_id")  # type: ignore

        if not assessment_id:
            raise NotFound("'assessment_id' is required")

        queryset = Question.objects.filter(
            assessment_id=assessment_id if assessment_id else None,
        )
        paginated_queryset = self.paginate_queryset(queryset)
        serializer = self.get_serializer(paginated_queryset, many=True)
        return self.get_paginated_response(serializer.data)
