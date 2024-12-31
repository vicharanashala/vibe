from rest_framework import viewsets

from ..serializers import CourseInstanceSerializer
from ..models import CourseInstance
from ...utils.helpers import get_user

class CourseInstanceViewSet(viewsets.ModelViewSet):
    serializer_class = CourseInstanceSerializer

    def get_queryset(self):
        return CourseInstance.objects.accessible_by(get_user(self.request.user))
