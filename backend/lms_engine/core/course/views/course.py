from rest_framework import viewsets
from ..serializers import CourseListSerializer, CourseDetailSerializer
from ..models import Course
from ...utils.helpers import get_user

class CourseViewSet(viewsets.ModelViewSet):
    def get_queryset(self):
        return Course.objects.accessible_by(get_user(self.request.user))

    def get_serializer_class(self):
        if self.action in ['list', 'retrieve']:
            return CourseDetailSerializer if self.action == 'retrieve' else CourseListSerializer
        return CourseDetailSerializer