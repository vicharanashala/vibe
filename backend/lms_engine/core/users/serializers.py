from rest_framework import serializers
from .models import User, UserInstitution, UserCourseInstance

class UserSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = ['id', 'email', 'password', 'firebase_uid']

    def create(self, validated_data):
        password = validated_data.pop('password')
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        return user


class UserInstitutionSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserInstitution
        fields = '__all__'
        
class UserCoursesSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserCourseInstance
        fields = '__all__'