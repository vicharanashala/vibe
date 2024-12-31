from oauth2_provider.models import (
    AccessToken,
    RefreshToken,
    get_application_model,
    Grant,
)
from oauth2_provider.settings import oauth2_settings
from datetime import timedelta
from django.utils.timezone import now
import secrets
from django.contrib.auth import authenticate
from rest_framework.response import Response
from rest_framework import status

from core import settings
from core.auth.constants import DEFAULT_SCOPE
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny


@api_view(["POST"])
@permission_classes([AllowAny])
def login(request):
    email = request.data.get("email")
    password = request.data.get("password")
    client_id = request.data.get("client_id")
    scope = request.data.get("scope", DEFAULT_SCOPE)

    # Validate required parameters
    if not all([email, password, client_id]):
        return Response(
            {"error": "Missing required parameters: email, password, client_id"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # Authenticate the user
    user = authenticate(request, email=email, password=password)
    if not user:
        return Response(
            {"error": "Invalid email or password"}, status=status.HTTP_401_UNAUTHORIZED
        )

    if not user.is_active:
        return Response(
            {"error": "User account is inactive."},
            status=status.HTTP_403_FORBIDDEN,
        )

    # Validate client application
    Application = get_application_model()
    try:
        application = Application.objects.get(client_id=client_id)
    except Application.DoesNotExist:
        return Response(
            {"error": "Invalid client_id"}, status=status.HTTP_400_BAD_REQUEST
        )

    # Revoke existing tokens for the user
    AccessToken.objects.filter(user=user).delete()
    RefreshToken.objects.filter(user=user).delete()

    # Generate an authorization code
    authorization_code = secrets.token_urlsafe(32)
    grant = Grant.objects.create(
        user=user,
        application=application,
        code=authorization_code,
        expires=now() + timedelta(seconds=oauth2_settings.AUTHORIZATION_CODE_EXPIRE_SECONDS),  # type: ignore
        redirect_uri=settings.LOGIN_REDIRECT_URL,
        scope=scope,
    )

    expires = now() + timedelta(seconds=oauth2_settings.ACCESS_TOKEN_EXPIRE_SECONDS)  # type: ignore
    access_token = AccessToken.objects.create(
        user=grant.user,
        application=grant.application,
        token=secrets.token_urlsafe(32),
        expires=expires,
        scope=grant.scope,
    )

    refresh_token = RefreshToken.objects.create(
        user=grant.user,
        token=secrets.token_urlsafe(32),
        access_token=access_token,
        application=grant.application,
    )

    grant.delete()

    return Response(
        {
            "access_token": access_token.token,
            "expires_in": oauth2_settings.ACCESS_TOKEN_EXPIRE_SECONDS,
            "refresh_token": refresh_token.token,
            "token_type": "Bearer",
            "scope": access_token.scope,
        },
        status=status.HTTP_200_OK,
    )
