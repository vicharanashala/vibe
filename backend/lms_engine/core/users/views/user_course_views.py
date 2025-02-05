from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from drf_spectacular.utils import extend_schema_view, extend_schema
from ..models import UserCourseInstance
from ..serializers import UserCoursesSerializer

@extend_schema_view(
    list=extend_schema(
        tags=["UserCourseInstance"],
        summary="List User-Course Relations",
        description="Retrieve a list of user-course enrollments.",
        responses=UserCoursesSerializer,
    ),
    retrieve=extend_schema(
        tags=["UserCourseInstance"],
        summary="Retrieve a User-Course Relation",
        description="Retrieve details of a user's enrollment in a course.",
        responses=UserCoursesSerializer,
    ),
    create=extend_schema(
        tags=["UserCourseInstance"],
        summary="Enroll User in Course",
        description="Enroll a user in a specific course instance.",
        request=UserCoursesSerializer,
        responses=UserCoursesSerializer,
    ),
    destroy=extend_schema(
        tags=["UserCourseInstance"],
        summary="Unenroll User from Course",
        description="Remove a user from a course.",
        responses={"204": "User unenrolled from course."},
    ),
)
class UserCourseInstanceViewSet(viewsets.ModelViewSet):
    """
    API endpoint for managing user-course enrollments.
    """
    permission_classes = [IsAuthenticated]
    queryset = UserCourseInstance.objects.all()
    serializer_class = UserCoursesSerializer
