from rest_framework import serializers
from .models import User, UserInstitution, UserRole, UserCourse

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = '__all__'

class UserInstitutionSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserInstitution
        fields = '__all__'

class UserRoleSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserRole
        fields = '__all__'
        
class UserCoursesSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserCourse
        fields = '__all__'