from rest_framework import viewsets, status
from rest_framework.response import Response
from .models import Course, Module, Section, SectionItem
from .serializers import CourseSerializer, ModuleSerializer, SectionSerializer
from ..user.models import UserCourse
from ..user.serializers import UserCoursesSerializer
from ..permissions import IsStudentReadOnly
from rest_framework.permissions import IsAuthenticated
from django.db.models import Exists, OuterRef

class CourseViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing courses.
    """
    serializer_class = CourseSerializer
    permission_classes = [IsAuthenticated]

    queryset = Course.objects.none()

    def get_queryset(self):
        user = self.request.user
        queryset = Course.objects.annotate(
            enrolled=Exists(UserCourse.objects.filter(user=user, course_id=OuterRef('id')))
        )
        if user.role == 'Student':
            queryset = queryset.filter(visibility=True)
        return queryset


class ModuleViewSet(viewsets.ModelViewSet):
    """
    A viewset for managing modules within a course.
    Allows listing, creating, updating, retrieving, and deleting modules.
    """
    serializer_class = ModuleSerializer
    permission_classes = [IsStudentReadOnly, IsAuthenticated]

    def get_queryset(self):
        queryset = Module.objects.prefetch_related('sections')
        course_id = self.request.query_params.get('course', None)
        if course_id:
            queryset = queryset.filter(course_id=course_id)
        sequence = self.request.query_params.get('sequence', None)
        if sequence:
            queryset = queryset.filter(sequence=sequence)

        if queryset.exists():
            return queryset
        return Module.objects.all()



    def list(self, request, *args, **kwargs):
        """
        List all modules for the course specified in the URL.
        """
        queryset = self.get_queryset()
        if not queryset.exists():
            return Response(status=status.HTTP_404_NOT_FOUND)
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)


class SectionViewSet(viewsets.ModelViewSet):
    queryset = Section.objects.all()
    serializer_class = SectionSerializer
