from firebase_admin import auth
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from django.db import transaction

from core.users.models import User
from core.users.serializers import UserSerializer


class SignupView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        email = request.data.get("email")
        password = request.data.get("password")
        first_name = request.data.get("first_name")
        last_name = request.data.get("last_name")

        try:
            with transaction.atomic():
                # Create Firebase user
                firebase_user = auth.create_user(
                    email=email,
                    password=password,
                    display_name=f"{first_name} {last_name}",
                )

                # Create Django user
                user = User.objects.create(
                    email=email,
                    firebase_uid=firebase_user.uid,
                    first_name=first_name,
                    last_name=last_name,
                )
                serializer = UserSerializer(user)
                return Response(serializer.data, status=status.HTTP_201_CREATED)

        except Exception as e:
            # Rollback Firebase user creation if any failure occurs
            if 'firebase_user' in locals():
                auth.delete_user(firebase_user.uid)
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

class LoginView(APIView):
    def post(self, request):
        # Extract Firebase ID token from the request
        id_token = request.data.get("id_token")

        if not id_token:
            return Response(
                {"error": "ID token is required for login."},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            # Verify the Firebase ID token
            decoded_token = auth.verify_id_token(id_token)
            firebase_uid = decoded_token.get("uid")

            if not firebase_uid:
                return Response(
                    {"error": "Invalid Firebase ID token."},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Get or create the user in the local database
            user, created = User.objects.get_or_create(
                firebase_uid=firebase_uid,
                defaults={
                    "email": decoded_token.get("email"),
                    "first_name": decoded_token.get("name", ""),
                },
            )

            # Return success response
            return Response(
                {
                    "message": "Login successful.",
                    "user": {
                        "firebase_uid": user.firebase_uid,
                        "email": user.email,
                        "name": user.first_name,
                    },
                },
                status=status.HTTP_200_OK,
            )
        except Exception as e:
            return Response(
                {"error": f"Authentication failed: {str(e)}"},
                status=status.HTTP_401_UNAUTHORIZED,
            )
