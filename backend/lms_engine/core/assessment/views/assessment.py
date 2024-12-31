from rest_framework import viewsets
from rest_framework.exceptions import MethodNotAllowed
from ..models import Assessment
from ..serializers import AssessmentSerializer

class AssessmentViewSet(viewsets.ModelViewSet):
    queryset = Assessment.objects.all()
    serializer_class = AssessmentSerializer

    def list(self, request, *args, **kwargs):
        raise MethodNotAllowed("GET", detail="Listing is not allowed for this resource.")
