from django.db import transaction
from drf_spectacular.utils import extend_schema
from firebase_admin import auth
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from core.authentication.serializers.signup_serializer import SignupSerializer
from core.users.models import User
from core.users.serializers import UserSerializer

@extend_schema(
    tags=["Auth"],
    request=SignupSerializer,
    summary="Signup",
    description="Register a new user in the system.",
)
class SignupView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = SignupSerializer(data=request.data)
        if serializer.is_valid():

            user = User.objects.create_user(
                email=serializer.validated_data['email'],
                password=serializer.validated_data['password'],
                first_name=serializer.validated_data['first_name'],
                last_name=serializer.validated_data['last_name'],
            )
            user_serializer = UserSerializer(user)
            return Response(user_serializer.data, status=status.HTTP_201_CREATED)
        else:
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)



