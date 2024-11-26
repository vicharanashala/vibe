from rest_framework.decorators import api_view
from rest_framework.response import Response
from home.serializers import ProgramSerializer, ProgramGroupMappingSerializer, GroupSerializer
from .models import Program, ProgramGroupMapping, Group, Profile
from datetime import datetime

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.decorators import api_view
from rest_framework import status
from django.contrib.auth.models import User
from rest_framework.exceptions import PermissionDenied
from rest_framework_simplejwt.authentication import JWTAuthentication

# Custom permission decorator for role-based access
def role_required(roles):
    def decorator(func):
        def wrapper(self, request, *args, **kwargs):
            user_role = Profile.objects.get(username=request.user).user_type
            if user_role not in roles:
                raise PermissionDenied("You do not have permission to perform this action.")
            return func(self, request, *args, **kwargs)
        return wrapper
    return decorator

class ProgramsView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        """Authenticated users can fetch programs."""
        args = request.GET.get("search")
        if args:
            programs = Program.objects.filter(name__icontains=args)
            if not programs:
                return Response({'error': 'Program not found'}, status=status.HTTP_404_NOT_FOUND)
        else:
            programs = Program.objects.all()
        serializer = ProgramSerializer(programs, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @role_required(roles=["admin", "moderator", "superadmin", "staff", "instructor"])
    def post(self, request):
        """Only specific roles can add programs."""
        programs = Program.objects.filter(name=request.data.get('name'))
        if programs.exists():
            return Response({'error': 'Program already exists'}, status=status.HTTP_400_BAD_REQUEST)
        serializer = ProgramSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @role_required(roles=["admin", "moderator", "superadmin", "staff", "instructor"])
    def put(self, request):
        """Only specific roles can update programs."""
        programs = Program.objects.filter(name=request.data.get('name'))
        if not programs.exists():
            return Response({'error': 'Program not found'}, status=status.HTTP_404_NOT_FOUND)
        serializer = ProgramSerializer(programs.first(), data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)