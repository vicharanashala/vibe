from rest_framework.decorators import api_view
from rest_framework.response import Response
from django.shortcuts import render, redirect
from datetime import datetime
from rest_framework.authtoken.models import Token

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework.exceptions import AuthenticationFailed

class CoursesView(APIView):
    """
    View for fetching courses. Validates the access token.
    """
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        # Protected data (courses)
        courses = [
            {"id": 1, "name": "Django Basics"},
            {"id": 2, "name": "Advanced REST APIs"},
            {"id": 3, "name": "Machine Learning Fundamentals"},
        ]

        return Response({"courses": courses}, status=200)
