from rest_framework.response import Response
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from .forms import CustomSignupForm

@api_view(["POST"])
@permission_classes([AllowAny])
def signup(request):
    """
    Register a new user with custom fields.
    """
    data = {
        "email": request.data.get("email"),
        "password1": request.data.get("password"),
        "first_name": request.data.get("first_name"),
        "last_name": request.data.get("last_name"),
        "role": request.data.get("role"),
    }

    # Validate required fields
    required_fields = ["email", "password1"]
    missing_fields = [field for field in required_fields if not data.get(field)]
    if missing_fields:
        return Response(
            {"error": f"Missing required fields: {', '.join(missing_fields)}"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    form = CustomSignupForm(data)
    if form.is_valid():
        try:
            user = form.save(request)
            return Response(
                {
                    "message": "User registered successfully.",
                    "user": {
                        "email": user.email,
                        "first_name": user.first_name,
                        "last_name": user.last_name,
                        "role": user.role,
                    }
                },
                status=status.HTTP_201_CREATED
            )
        except Exception as e:
            return Response(
                {"error": str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    return Response({"errors": form.errors}, status=status.HTTP_400_BAD_REQUEST)