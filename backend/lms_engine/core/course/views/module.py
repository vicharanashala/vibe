from rest_framework import viewsets
from ..serializers import ModuleListSerializer, ModuleDetailSerializer
from ..models import Module
from ...utils.helpers import get_user


class ModuleViewSet(viewsets.ModelViewSet):
    def get_queryset(self):
        queryset = Module.objects.accessible_by(get_user(self.request.user))

        course_id = self.request.query_params.get('course_id')

        if course_id is not None:
            return queryset.filter(course_id=course_id)
        
        return queryset

    def get_serializer_class(self):
        if self.action in ['list', 'retrieve']:
            return ModuleDetailSerializer if self.action == 'retrieve' else ModuleListSerializer
        return ModuleDetailSerializer