from rest_framework.response import Response
from rest_framework import status
from oauth2_provider.views import TokenView
from rest_framework.decorators import api_view
from django.http import QueryDict

@api_view(["POST"])
def refresh_token(request):
    refresh_token_str = request.data.get("refresh_token")
    client_id = request.data.get("client_id")

    if not refresh_token_str or not client_id:
        return Response(
            {"error": "Missing required parameters: refresh_token, client_id"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # Prepare the token request
    token_request_data = QueryDict("", mutable=True)
    token_request_data.update({
        "grant_type": "refresh_token",
        "refresh_token": refresh_token_str,
        "client_id": client_id,
    })

    token_request = request._request
    token_request.POST = token_request_data
    token_request.method = "POST"

    token_view = TokenView.as_view()
    response = token_view(token_request)

    return response

