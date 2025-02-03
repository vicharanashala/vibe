from rest_framework import viewsets
from drf_spectacular.utils import extend_schema, extend_schema_view, OpenApiParameter
from ..serializers import ModuleListSerializer, ModuleDetailSerializer
from ..models import Module
from ...utils.helpers import get_user


@extend_schema_view(
    list=extend_schema(
        tags=["Module"],
        summary="List Modules",
        description="Retrieve a list of modules accessible by the current user. Optionally filter by course_id.",
        parameters=[
            OpenApiParameter(
                name="course_id",
                description="Filter modules by course ID",
                required=False,
                type=int,
            )
        ],
        responses=ModuleListSerializer,
    ),
    retrieve=extend_schema(
        tags=["Module"],
        summary="Retrieve a Module",
        description="Retrieve detailed information for a specific module.",
        responses=ModuleDetailSerializer,
    ),
    create=extend_schema(
        tags=["Module"],
        summary="Create a Module",
        description="Create a new module with the provided data.",
        request=ModuleDetailSerializer,
        responses=ModuleDetailSerializer,
    ),
    update=extend_schema(
        tags=["Module"],
        summary="Update a Module",
        description="Update an existing module with new data.",
        request=ModuleDetailSerializer,
        responses=ModuleDetailSerializer,
    ),
    partial_update=extend_schema(
        tags=["Module"],
        summary="Partially Update a Module",
        description="Update selected fields of an existing module.",
        request=ModuleDetailSerializer,
        responses=ModuleDetailSerializer,
    ),
    destroy=extend_schema(
        tags=["Module"],
        summary="Delete a Module",
        description="Delete an existing module.",
        responses={"204": "Module deleted successfully."},
    ),
)
class ModuleViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing modules. Provides actions to list, retrieve, create, update, and delete modules.
    """

    def get_queryset(self):
        """
        Retrieve the list of modules accessible by the current user.
        Optionally filter by course_id.
        """
        queryset = Module.objects.all()
        course_id = self.request.query_params.get("course_id")
        if course_id is not None:
            return queryset.filter(course_id=course_id)
        return queryset

    def get_serializer_class(self):
        """
        Return the appropriate serializer class based on the action.
        """
        if self.action in ["list", "retrieve"]:
            return ModuleDetailSerializer if self.action == "retrieve" else ModuleListSerializer
        return ModuleDetailSerializer
