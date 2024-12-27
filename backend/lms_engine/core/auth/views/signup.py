from rest_framework.response import Response
from rest_framework import status
from allauth.account.forms import SignupForm
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny


@api_view(["POST"])
@permission_classes([AllowAny])
def signup(request):
    """
    Register a new user.
    """
    email = request.data.get("email")
    password = request.data.get("password")
    first_name = request.data.get("first_name")
    last_name = request.data.get("last_name")

    if not email or not password:
        return Response(
            {"error": "Email and password are required."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # Populate additional fields if required
    data = {
        "email": email,
        "password1": password,
        "password2": password,
        "first_name": first_name,
        "last_name": last_name,
    }

    form = SignupForm(data)
    if form.is_valid():
        form.save(request)
        return Response(
            {"message": "User registered successfully."}, status=status.HTTP_201_CREATED
        )

    return Response({"errors": form.errors}, status=status.HTTP_400_BAD_REQUEST)
