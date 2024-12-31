from rest_framework.response import Response
from rest_framework import status
from rest_framework.decorators import api_view


@api_view(["POST"])
def change_password(request):
    """
    Change the user's password.
    """
    user = request.user
    old_password = request.data.get("old_password")
    new_password = request.data.get("new_password")

    if not old_password or not new_password:
        return Response(
            {"error": "Both old and new passwords are required."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if not user.check_password(old_password):
        return Response(
            {"error": "Old password is incorrect."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    user.set_password(new_password)
    user.save()
    return Response(
        {"message": "Password changed successfully."}, status=status.HTTP_200_OK
    )
