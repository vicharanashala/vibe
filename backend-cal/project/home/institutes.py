from rest_framework.decorators import api_view
from rest_framework.response import Response
from home.serializers import InstitutionSerializer
from .models import Institution, Profile
from datetime import datetime
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework.views import APIView

class InstitutesView(APIView):
    """
    Handles operations related to institutions, including:
    - GET: Retrieve all institutions or search by name (accessible to any authenticated user).
    - POST: Create a new institution (restricted to superadmin).
    - PUT: Update an existing institution (restricted to superadmin).
    - DELETE: Delete an institution (restricted to superadmin).
    """
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        """
        Retrieves institutions. Optionally filters by search query.
        Accessible to any authenticated user.
        """
        args = request.GET.get("search")
        if args:
            institutes = Institution.objects.filter(name__icontains=args)
            if not institutes.exists():
                return Response({'error': 'Institution not found'}, status=status.HTTP_404_NOT_FOUND)
        else:
            institutes = Institution.objects.all()

        serializer = InstitutionSerializer(institutes, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def post(self, request):
        """
        Creates a new institution. Restricted to superadmin users.
        """
        if not self.is_superadmin(request.user):
            return Response({'error': f'You do not have permission to perform this action.'}, status=status.HTTP_403_FORBIDDEN)

        institutes = Institution.objects.filter(name__icontains=request.data.get('name'))
        if institutes.exists():
            return Response({'error': 'Institution already exists'}, status=status.HTTP_400_BAD_REQUEST)

        serializer = InstitutionSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def put(self, request):
        """
        Updates an existing institution. Restricted to superadmin users.
        """
        if not self.is_superadmin(request.user):
            return Response({'error': 'You do not have permission to perform this action.'}, status=status.HTTP_403_FORBIDDEN)

        institutes = Institution.objects.filter(name__icontains=request.data.get('name'))
        if not institutes.exists():
            return Response({'error': 'Institution not found'}, status=status.HTTP_404_NOT_FOUND)

        serializer = InstitutionSerializer(institutes.first(), data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @staticmethod
    def is_superadmin(user):
        """
        Checks if the user has a superadmin role.
        """
        user_profile = Profile.objects.get(username=user)
        return user_profile.user_type == 'superadmin'
