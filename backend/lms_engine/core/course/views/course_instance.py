from rest_framework import viewsets

from ..serializers import CourseInstanceReadSerializer, CourseInstanceWriteSerializer
from ..models import CourseInstance
from ...utils.helpers import get_user

class CourseInstanceViewSet(viewsets.ModelViewSet):
    
    def get_serializer_class(self):
        # TODO: Look into this when implementing update and delete methods. 
        if self.action == 'create':
            return CourseInstanceWriteSerializer
        return CourseInstanceReadSerializer

    def get_queryset(self):
        return CourseInstance.objects.accessible_by(get_user(self.request.user))
