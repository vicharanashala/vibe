from rest_framework import serializers
from .models import User, UserInstitution, UserCourseInstance

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = '__all__'

class UserInstitutionSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserInstitution
        fields = '__all__'
        
class UserCoursesSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserCourseInstance
        fields = '__all__'