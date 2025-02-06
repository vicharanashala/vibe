from django.core.exceptions import PermissionDenied
from drf_spectacular.utils import OpenApiParameter, extend_schema, extend_schema_view
from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated

from ...utils.helpers import get_user
from ..models import CourseInstance
from ..serializers.course_instance import (
    CourseInstanceReadSerializer,
    CourseInstanceWriteSerializer,
)


@extend_schema_view(
    list=extend_schema(
        tags=["Course Instance"],
        summary="List Course Instances",
        description="Retrieve a list of course instances accessible by the current user.",
        responses=CourseInstanceReadSerializer,
    ),
    retrieve=extend_schema(
        tags=["Course Instance"],
        summary="Retrieve a Course Instance",
        description="Retrieve detailed information for a single course instance.",
        responses=CourseInstanceReadSerializer,
    ),
    create=extend_schema(
        tags=["Course Instance"],
        summary="Create a Course Instance",
        description="Create a new course instance with the provided data.",
        request=CourseInstanceWriteSerializer,
        responses=CourseInstanceWriteSerializer,
    ),
    update=extend_schema(
        tags=["Course Instance"],
        summary="Update a Course Instance",
        description="Update an existing course instance with new data.",
        request=CourseInstanceWriteSerializer,
        responses=CourseInstanceWriteSerializer,
    ),
    partial_update=extend_schema(
        tags=["Course Instance"],
        summary="Partially Update a Course Instance",
        description="Update selected fields of an existing course instance.",
        request=CourseInstanceWriteSerializer,
        responses=CourseInstanceWriteSerializer,
    ),
    destroy=extend_schema(
        tags=["Course Instance"],
        summary="Delete a Course Instance",
        description="Delete an existing course instance.",
        responses={"204": "Course instance deleted successfully."},
    ),
)
class CourseInstanceViewSet(viewsets.ModelViewSet):

    def get_serializer_class(self):
        # TODO: Look into this when implementing update and delete methods.
        if self.action == "create":
            return CourseInstanceWriteSerializer
        return CourseInstanceReadSerializer

    def get_queryset(self):
        """
        Retrieve the list of course instances accessible by the current user.
        """
        return CourseInstance.objects.all()
