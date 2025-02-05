from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from drf_spectacular.utils import extend_schema_view, extend_schema
from ..models import User
from ..serializers import UserSerializer

@extend_schema_view(
    list=extend_schema(
        tags=["User"],
        summary="List Users",
        description="Retrieve a list of users in the system.",
        responses=UserSerializer,
    ),
    retrieve=extend_schema(
        tags=["User"],
        summary="Retrieve a User",
        description="Retrieve detailed information for a specific user.",
        responses=UserSerializer,
    ),
    create=extend_schema(
        tags=["User"],
        summary="Create a User",
        description="Register a new user with Firebase authentication.",
        request=UserSerializer,
        responses=UserSerializer,
    ),
    update=extend_schema(
        tags=["User"],
        summary="Update a User",
        description="Update details of an existing user.",
        request=UserSerializer,
        responses=UserSerializer,
    ),
    partial_update=extend_schema(
        tags=["User"],
        summary="Partially Update a User",
        description="Update selected fields of a user.",
        request=UserSerializer,
        responses=UserSerializer,
    ),
    destroy=extend_schema(
        tags=["User"],
        summary="Delete a User",
        description="Delete a user from the system.",
        responses={"204": "User deleted successfully."},
    ),
)
class UserViewSet(viewsets.ModelViewSet):
    """
    API endpoint for managing users.
    """
    permission_classes = [IsAuthenticated]
    queryset = User.objects.all()
    serializer_class = UserSerializer
