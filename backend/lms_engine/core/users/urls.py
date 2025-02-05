from django.urls import path, include
from rest_framework.routers import DefaultRouter
from core.users.views.user_views import UserViewSet
from core.users.views.user_institution_views import UserInstitutionViewSet
from core.users.views.user_course_views import UserCourseInstanceViewSet

router = DefaultRouter()
router.register(r'users', UserViewSet, basename='user')
router.register(r'user-institutions', UserInstitutionViewSet, basename='user-institutions')
router.register(r'user-course-instances', UserCourseInstanceViewSet, basename='user-course-instances')

urlpatterns = [
    path('', include(router.urls)),
]
