from rest_framework import viewsets
from ..serializers import SectionListSerializer, SectionDetailSerializer
from ..models import Section
from ...utils.helpers import get_user


class SectionViewSet(viewsets.ModelViewSet):
    def get_queryset(self):
        queryset = Section.objects.accessible_by(get_user(self.request.user))

        course_id = self.request.query_params.get('course_id')
        if course_id is not None:
            return queryset.filter(module__course_id=course_id)

        module_id = self.request.query_params.get('module_id')
        if module_id is not None:
            return queryset.filter(module_id=module_id)

        return queryset

    def get_serializer_class(self):
        if self.action in ['list', 'retrieve']:
            return SectionDetailSerializer if self.action == 'retrieve' else SectionListSerializer
        return SectionDetailSerializer

