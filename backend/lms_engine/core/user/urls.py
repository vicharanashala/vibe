from rest_framework.routers import DefaultRouter
from .views import UserViewSet, UserInstitutionViewSet, UserCoursesViewSet

router = DefaultRouter()
router.register(r'users', UserViewSet)
router.register(r'user-institutions', UserInstitutionViewSet)
router.register(r'user-courses', UserCoursesViewSet)

urlpatterns = router.urls
