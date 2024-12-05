from rest_framework.routers import DefaultRouter
from .views import UserViewSet, UserInstitutionViewSet, UserRoleViewSet

router = DefaultRouter()
router.register(r'users', UserViewSet)
router.register(r'user-institutions', UserInstitutionViewSet)
router.register(r'user-roles', UserRoleViewSet)

urlpatterns = router.urls
