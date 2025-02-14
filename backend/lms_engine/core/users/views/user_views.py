from drf_spectacular.utils import extend_schema, extend_schema_view, OpenApiParameter
from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from rest_framework.response import Response
from rest_framework.decorators import action
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

    @extend_schema(
        tags=["User"],
        summary="Retrieve a User by Email",
        description="Retrieve a user's details using their email address.",
        parameters=[
            OpenApiParameter(name="email", description="User's email address", required=True, type=str),
        ],
        responses=UserSerializer,
    )
    @action(detail=False, methods=["get"], url_path="by-email")
    def retrieve_by_email(self, request):
        """
        Custom endpoint to retrieve user by email.
        Usage: /api/v1/users/by-email?email=user@example.com
        """
        email = request.query_params.get("email")

        if not email:
            return Response({"error": "Email parameter is required"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            user = User.objects.get(email=email)
            serializer = UserSerializer(user)
            return Response(serializer.data, status=status.HTTP_200_OK)
        except User.DoesNotExist:
            return Response({"error": "User not found"}, status=status.HTTP_404_NOT_FOUND)
