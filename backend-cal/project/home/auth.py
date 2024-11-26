from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import authenticate
from .serializers import UserRegistrationSerializer, profileSerializer
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework.exceptions import AuthenticationFailed
from django.contrib.auth.models import AnonymousUser
from home.models import Profile, PasswordResetToken
from datetime import datetime, timedelta
from rest_framework_simplejwt.tokens import AccessToken
from rest_framework.decorators import api_view
from django.db import transaction
from rest_framework.permissions import IsAuthenticated, AllowAny

from django.core.mail import send_mail
from django.conf import settings
import uuid
from django.template.loader import render_to_string
from django.utils.html import strip_tags

def check_auth(request, reqRole):
    jwt_authenticator = JWTAuthentication()
    try:
        validated_token = jwt_authenticator.get_validated_token(request.headers.get('x-access-token'))
        user = jwt_authenticator.get_user(validated_token)
        role = Profile.objects.get(user=user).role
        return user, role in reqRole
    except AuthenticationFailed:
        return AnonymousUser(), 'Unauthorized'


# User Registration
class UserRegistrationView(APIView):
    def post(self, request):

        if not request.data.get("user_type"):
            request.data["user_type"] = "user"

        userregistrationserializer = UserRegistrationSerializer(data=request.data)
        userprofileSerializer = profileSerializer(data=request.data)

        if userregistrationserializer.is_valid() and userprofileSerializer.is_valid():
            try:
                userregistrationserializer.save()
                userprofileSerializer.save()
                return Response({"message": "User registered successfully."}, status=status.HTTP_201_CREATED)
            except Exception as e:
                return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(userregistrationserializer.errors, status=status.HTTP_400_BAD_REQUEST)


class resetPasswordView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [AllowAny]

    def post(self, request, key):
        new_password = request.POST.get('password')
        user_id = PasswordResetToken.objects.get(token=key).user_id
        user_name = Profile.objects.get(id=user_id).username
        # Update password in django user table

        # Your implementation for password reset goes here
        return Response({'message': 'Password reset successful'}, status=status.HTTP_200_OK)


class check_login(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        user_role = Profile.objects.get(username=user).user_type
        return Response({"message": "User is logged in", "role": user_role}, status=status.HTTP_200_OK)


class resetPasswordView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    def post(self, request, key):
        new_password = request.POST.get('password')
        user_id = PasswordResetToken.objects.get(token=key).user_id
        user_name = Profile.objects.get(id=user_id).username
        # Update password in django user table

        # Your implementation for password reset goes here
        return Response({'message': 'Password reset successful'}, status=status.HTTP_200_OK)
    
# User Login
class UserLoginView(APIView):
    """
    Handles user login and provides role-based authentication.
    """

    authentication_classes = [JWTAuthentication]
    permission_classes = [AllowAny]  # POST (login) is accessible to all, others require authentication.

    def get_permissions(self):
        """
        Overrides permissions based on the HTTP method.
        """
        if self.request.method == 'POST':
            return [AllowAny()]  # Allow anyone to access POST (login).
        return [IsAuthenticated()]  # Require authentication for other methods.

    # Get user list
    def get(self, request):
        """
        Returns the role of the authenticated user.
        """
        user = request.user
        if user.is_anonymous:
            return Response({"error": "User not authenticated"}, status=status.HTTP_401_UNAUTHORIZED)

        user_profile = Profile.objects.get(username=user)

        try:
            required_roles = ['superadmin', 'admin', 'moderators']
            user_profiles = Profile.objects.filter(user_type__in=required_roles)  # Use filter() for multiple objects

            user_profiles_list = []
            for person in user_profiles:
                serialized_person = profileSerializer(person).data  # Serialize each profile
                user_profiles_list.append(serialized_person)

            return Response({"users": user_profiles_list}, status=status.HTTP_200_OK)

        except Profile.DoesNotExist:
            return Response({"error": "Profile not found"}, status=status.HTTP_404_NOT_FOUND)

    # Login
    def post(self, request):
        """
        Handles user login and returns a JWT access token.
        """
        username = request.data.get('username')
        password = request.data.get('password')

        # Get client IP address
        ip_address = self.get_client_ip(request)

        # Authenticate user
        user = authenticate(username=username, password=password)
        if user:
            try:
                # Fetch profile for role-based data
                profile = Profile.objects.get(username=user)
            except Profile.DoesNotExist:
                return Response({"error": "Profile not found"}, status=status.HTTP_404_NOT_FOUND)

            if profile.login == True:
                return Response({"error": "User already logged in"}, status=status.HTTP_400_BAD_REQUEST)
            
            # Generate JWT tokens
            refresh = RefreshToken.for_user(user)
            profile.last_ip = ip_address
            profile.login = True
            profile.save()

            return Response({
                "token": str(refresh.access_token),
                "role": profile.user_type,
            }, status=status.HTTP_200_OK)

        return Response({"error": "Invalid credentials"}, status=status.HTTP_401_UNAUTHORIZED)

    # Forgot password
    def put(self, request):
        """
        Sends a password reset email to the user.
        """

        try:
            user = Profile.objects.get(username=request.user)
        except Profile.DoesNotExist:
            return Response({"error": "User not found"}, status=status.HTTP_404_NOT_FOUND)

        # Generate a unique string uuid
        token = str(uuid.uuid4())
        expiration_time = datetime.now() + timedelta(hours=1)  # Token valid for 24 hours

        # Save the token to the PasswordResetToken model
        reset_token, created = PasswordResetToken.objects.update_or_create(
            user=user,
            defaults={
                "token": token,
                "expires_at": expiration_time,
            },
        )

        # Send password reset email
        self.send_password_reset_email(user, reset_token.token)

        return Response({"message": "Password reset email sent"}, status=status.HTTP_200_OK)
    
    # Logout
    def delete(self, request):
        """
        Logs out the user by blacklisting the refresh token and updating the profile.
        
        Returns:
            Response: JSON response indicating success or failure of logout operation
        """
        try:
            with transaction.atomic():
                # Get the user and their profile
                user = request.user
                if user.is_anonymous:
                    return Response({"error": "User not authenticated"}, status=status.HTTP_401_UNAUTHORIZED)

                # Extract token from Authorization header
                auth_header = request.headers.get('Authorization')
                if not auth_header or not auth_header.startswith('Bearer '):
                    return Response(
                        {"error": "Invalid token format"}, 
                        status=status.HTTP_400_BAD_REQUEST
                    )

                # Get and validate refresh token
                refresh_token = auth_header.split(' ')[1]
                try:
                    token = AccessToken(refresh_token)
                except:
                    return Response(
                        {"error": f"Invalid token"}, 
                        status=status.HTTP_400_BAD_REQUEST
                    )

                # Update profile
                try:
                    profile = Profile.objects.get(username=user)
                    profile.login = False
                    profile.last_ip = None
                    profile.save(update_fields=['login', 'last_ip'])
                except:
                    return Response(
                        {"error": "User profile not found"}, 
                        status=status.HTTP_404_NOT_FOUND
                    )

                # Blacklist the token
                token.blacklist()

                # Optional: Clear any session data if using session authentication
                if hasattr(request, 'session'):
                    request.session.flush()

                return Response(
                    {
                        "message": "User logged out successfully",
                        "user": user.username,
                        "timestamp": datetime.now()
                    }, 
                    status=status.HTTP_200_OK
                )

        except Exception as e:
            return Response(
                {
                    "error": "Logout failed",
                    "detail": str(e)
                }, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


    def send_password_reset_email(self, user, token):
        """
        Sends a password reset email to the user with an HTML template.
        """
        reset_url = f"http://127.0.0.1:3000/reset-password/{token}"  # Example frontend URL
        subject = "Password Reset Request"
        
        # Render the HTML template
        html_message = render_to_string("emails/password_reset.html", {"user": user, "reset_url": reset_url})
        plain_message = strip_tags(html_message)  # Fallback plain text version
        
        send_mail(
            subject=subject,
            message=plain_message,
            from_email="no-reply@vicharanshaala.com",
            recipient_list=[user.email],
            html_message=html_message,  # Attach the HTML message
            fail_silently=False,
        )


    @staticmethod
    def get_client_ip(request):
        """
        Fetches the client IP address.
        """
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            ip = x_forwarded_for.split(',')[0]
        else:
            ip = request.META.get('REMOTE_ADDR', 'Unknown')
        return ip