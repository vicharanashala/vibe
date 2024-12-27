from rest_framework.routers import DefaultRouter
from .views import UserViewSet, UserInstitutionViewSet

router = DefaultRouter()
router.register(r'users', UserViewSet)
router.register(r'user-institutions', UserInstitutionViewSet)

urlpatterns = router.urls
