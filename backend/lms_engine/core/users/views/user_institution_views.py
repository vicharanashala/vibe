from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated

from ..models import UserInstitution
from ..serializers import UserInstitutionSerializer


@extend_schema_view(
    list=extend_schema(
        tags=["UserInstitution"],
        summary="List User-Institution Relations",
        description="Retrieve a list of user-institution relationships.",
        responses=UserInstitutionSerializer,
    ),
    retrieve=extend_schema(
        tags=["UserInstitution"],
        summary="Retrieve a User-Institution Relation",
        description="Retrieve details of a user's institution membership.",
        responses=UserInstitutionSerializer,
    ),
    create=extend_schema(
        tags=["UserInstitution"],
        summary="Add User to Institution",
        description="Assign a user to an institution.",
        request=UserInstitutionSerializer,
        responses=UserInstitutionSerializer,
    ),
    destroy=extend_schema(
        tags=["UserInstitution"],
        summary="Remove User from Institution",
        description="Remove a user from an institution.",
        responses={"204": "User removed from institution."},
    ),
)
class UserInstitutionViewSet(viewsets.ModelViewSet):
    """
    API endpoint for managing user-institution relationships.
    """

    permission_classes = [IsAuthenticated]
    queryset = UserInstitution.objects.all()
    serializer_class = UserInstitutionSerializer
