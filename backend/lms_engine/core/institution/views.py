from django.shortcuts import get_object_or_404
from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework import status, viewsets
from rest_framework.response import Response

from .models import Institution
from .serializers import InstitutionSerializer


@extend_schema_view(
    list=extend_schema(
        tags=["Institution"],
        summary="List Institutions",
        description="Retrieve a list of all institutions.",
        responses=InstitutionSerializer,
    ),
    create=extend_schema(
        tags=["Institution"],
        summary="Create Institution",
        description=(
            "Create a new institution with the provided data.\n\n"
            "Required fields: name, description"
        ),
        request=InstitutionSerializer,
        responses=InstitutionSerializer,
    ),
    retrieve=extend_schema(
        tags=["Institution"],
        summary="Retrieve Institution",
        description="Get detailed information for a specific institution.",
        responses=InstitutionSerializer,
    ),
    update=extend_schema(
        tags=["Institution"],
        summary="Update Institution",
        description=(
            "Update all fields of an existing institution.\n\n"
            "Required fields: name, description"
        ),
        request=InstitutionSerializer,
        responses=InstitutionSerializer,
    ),
    partial_update=extend_schema(
        tags=["Institution"],
        summary="Partially Update Institution",
        description="Update selected fields of an existing institution.",
        request=InstitutionSerializer,
        responses=InstitutionSerializer,
    ),
    destroy=extend_schema(
        tags=["Institution"],
        summary="Deactivate Institution",
        description=(
            "Deactivate an institution by setting is_active to False.\n\n"
            "Note: This endpoint does not delete the institution from the database."
        ),
        responses={
            200: {
                "type": "object",
                "properties": {
                    "message": {
                        "type": "string",
                        "example": "Institution 'Example University' has been deactivated.",
                    }
                },
            }
        },
    ),
)
class InstitutionViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing Institution objects. Provides CRUD operations:
    Create (POST), Retrieve (GET), Update (PUT), and Delete (DELETE).

    Header:
        Authorization: Bearer <Access token>
    Args:
        request (Request): The HTTP request object containing metadata (name, description)
        *args (tuple): Additional positional arguments passed to the method.
        **kwargs (dict): Contains the `pk` (primary key) of the institution to deactivate.
    Returns:
        Response: A DRF Response object containing a success message and an
                    HTTP status code (200 OK) confirming the deactivation.
    """

    queryset = Institution.objects.all()
    serializer_class = InstitutionSerializer

    def destroy(self, request, *args, **kwargs):
        # Deactivate an institution by setting `is_active` to False instead of deleting it.
        instance = self.get_object()
        instance.is_active = False
        instance.save()  # Save changes to the database
        return Response(
            {"message": f"Institution '{instance.name}' has been deactivated."},
            status=status.HTTP_200_OK,
        )
