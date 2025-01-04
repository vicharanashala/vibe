from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from .models import User, UserInstitution, UserCourseInstance, Roles
from .serializers import (
    UserSerializer, 
    UserInstitutionSerializer, 
    UserCoursesSerializer, 
    StudentCourseSerializer
)
from ..course.models import CourseInstance

class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all()
    serializer_class = UserSerializer

    @action(detail=True, methods=['post'])
    def register_course(self, request, pk=None):
        user = self.get_object()
        course_id = request.data.get('course_id')
        
        if not course_id:
            return Response(
                {"error": "course_id is required"}, 
                status=status.HTTP_400_BAD_REQUEST
            )

        if user.role != Roles.STUDENT:
            return Response(
                {"error": "Only students can register for courses"}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            course_instance = get_object_or_404(CourseInstance, id=course_id)
            
            # Check if already registered
            if UserCourseInstance.objects.filter(user=user, course=course_instance).exists():
                return Response(
                    {"error": "Already registered for this course"}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            UserCourseInstance.objects.create(user=user, course=course_instance)
            return Response(
                {"message": "Successfully registered for course"},
                status=status.HTTP_201_CREATED
            )
        except Exception as e:
            return Response(
                {"error": str(e)}, 
                status=status.HTTP_400_BAD_REQUEST
            )

    @action(detail=True, methods=['get'])
    def registered_courses(self, request, pk=None):
        user = self.get_object()
        
        if user.role != Roles.STUDENT:
            return Response(
                {"error": "Only students can have registered courses"}, 
                status=status.HTTP_400_BAD_REQUEST
            )
            
        # Get all courses through the many-to-many relationship
        courses = CourseInstance.objects.filter(
            usercourseinstance__user=user
        )
        
        # Use the updated serializer
        serializer = StudentCourseSerializer(courses, many=True)
        return Response(serializer.data)


class UserInstitutionViewSet(viewsets.ModelViewSet):
    queryset = UserInstitution.objects.all()
    serializer_class = UserInstitutionSerializer

class UserCoursesViewSet(viewsets.ModelViewSet):
    queryset = UserCourseInstance.objects.all()
    serializer_class = UserCoursesSerializer