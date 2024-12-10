from rest_framework import viewsets, status
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from .models import Institution
from .serializers import InstitutionSerializer

class InstitutionViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing Institution objects. Provides CRUD operations: 
    Create (POST), Retrieve (GET), Update (PUT), and Delete (DELETE).
    
    Header:
        Authorization: Bearer <Access token>

    Args:
        request (Request): The HTTP request object containing metadata (name, description)
        *args (tuple): Additional positional arguments passed to the method.
        **kwargs (dict): Contains the `pk` (primary key) of the institution to deactivate.

    Returns:
        Response: A DRF Response object containing a success message and an 
                    HTTP status code (200 OK) confirming the deactivation.
    """
    queryset = Institution.objects.all()
    serializer_class = InstitutionSerializer

    def destroy(self, request, *args, **kwargs):
        # Deactivate an institution by setting `is_active` to False instead of deleting it.
        instance = self.get_object()
        instance.is_active = False
        instance.save()  # Save changes to the database

        return Response(
            {"message": f"Institution '{instance.name}' has been deactivated."},
            status=status.HTTP_200_OK,
        )
