from rest_framework import viewsets
from .models import User, UserInstitution, UserRole, UserCourse
from .serializers import UserSerializer, UserInstitutionSerializer, UserRoleSerializer, UserCoursesSerializer

class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all()
    serializer_class = UserSerializer

class UserInstitutionViewSet(viewsets.ModelViewSet):
    queryset = UserInstitution.objects.all()
    serializer_class = UserInstitutionSerializer

class UserRoleViewSet(viewsets.ModelViewSet):
    queryset = UserRole.objects.all()
    serializer_class = UserRoleSerializer

class UserCoursesViewSet(viewsets.ModelViewSet):
    queryset = UserCourse.objects.all()
    serializer_class = UserCoursesSerializer