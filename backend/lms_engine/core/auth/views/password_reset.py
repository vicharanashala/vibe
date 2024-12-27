from rest_framework.response import Response
from rest_framework import status
from allauth.account.forms import ResetPasswordForm
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny


@api_view(["POST"])
@permission_classes([AllowAny])
def password_reset(request):
    """
    Send a password reset email.
    """
    email = request.data.get("email")

    if not email:
        return Response(
            {"error": "Email is required."}, status=status.HTTP_400_BAD_REQUEST
        )

    form = ResetPasswordForm(data={"email": email})
    if form.is_valid():
        form.save(
            request=request,
            use_https=True,
            from_email=None,
            email_template_name="registration/password_reset_email.html",
        )
        return Response(
            {"message": "Password reset email sent."}, status=status.HTTP_200_OK
        )

    return Response({"errors": form.errors}, status=status.HTTP_400_BAD_REQUEST)
