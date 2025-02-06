from drf_spectacular.utils import (OpenApiParameter, extend_schema,
                                   extend_schema_view)
from rest_framework import viewsets

from ...utils.helpers import get_user
from ..models import Section
from ..serializers import SectionDetailSerializer, SectionListSerializer


@extend_schema_view(
    list=extend_schema(
        tags=["Section"],
        summary="List Sections",
        description=(
            "Retrieve a list of sections accessible by the current user. "
            "Optionally filter by `course_id` or `module_id`."
        ),
        parameters=[
            OpenApiParameter(
                name="course_id",
                description="Filter sections by course ID.",
                required=False,
                type=int,
            ),
            OpenApiParameter(
                name="module_id",
                description="Filter sections by module ID.",
                required=False,
                type=int,
            ),
        ],
        responses=SectionListSerializer,
    ),
    retrieve=extend_schema(
        tags=["Section"],
        summary="Retrieve a Section",
        description="Retrieve detailed information for a specific section.",
        responses=SectionDetailSerializer,
    ),
    create=extend_schema(
        tags=["Section"],
        summary="Create a Section",
        description="Create a new section with the provided data.",
        request=SectionDetailSerializer,
        responses=SectionDetailSerializer,
    ),
    update=extend_schema(
        tags=["Section"],
        summary="Update a Section",
        description="Update an existing section with new data.",
        request=SectionDetailSerializer,
        responses=SectionDetailSerializer,
    ),
    partial_update=extend_schema(
        tags=["Section"],
        summary="Partially Update a Section",
        description="Update selected fields of an existing section.",
        request=SectionDetailSerializer,
        responses=SectionDetailSerializer,
    ),
    destroy=extend_schema(
        tags=["Section"],
        summary="Delete a Section",
        description="Delete an existing section.",
        responses={"204": "Section deleted successfully."},
    ),
)
class SectionViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing sections. Provides actions to list, retrieve, create, update, and delete sections.
    """

    def get_queryset(self):
        """
        Retrieve the list of sections accessible by the current user.
        Optionally filter by `course_id` or `module_id`.
        """
        queryset = Section.objects.all()

        course_id = self.request.query_params.get("course_id")
        if course_id is not None:
            return queryset.filter(module__course_id=course_id)

        module_id = self.request.query_params.get("module_id")
        if module_id is not None:
            return queryset.filter(module_id=module_id)

        return queryset

    def get_serializer_class(self):
        """
        Return the appropriate serializer class based on the action.
        """
        if self.action in ["list", "retrieve"]:
            return (
                SectionDetailSerializer
                if self.action == "retrieve"
                else SectionListSerializer
            )
        return SectionDetailSerializer
