from rest_framework import serializers
from .models import User, UserInstitution, UserCourseInstance
from ..course.models import CourseInstance  # Import the actual model

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = '__all__'
        extra_kwargs = {
            'password': {'write_only': True}
        }

class UserInstitutionSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserInstitution
        fields = '__all__'
        
class UserCoursesSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserCourseInstance
        fields = '__all__'

class StudentCourseSerializer(serializers.ModelSerializer):
    course_name = serializers.CharField(source='course.name', read_only=True)

    class Meta:
        model = CourseInstance  # Use the actual model class instead of string
        fields = ['id', 'course', 'course_name']  # Adjust these fields
