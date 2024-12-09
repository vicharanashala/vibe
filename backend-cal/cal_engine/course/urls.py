from rest_framework.routers import DefaultRouter
from .views import CourseViewSet, ModuleViewSet, SectionViewSet

router = DefaultRouter()
router.register(r'courses', CourseViewSet, basename='course')
router.register(r'modules', ModuleViewSet, basename='module')
router.register(r'sections', SectionViewSet)
urlpatterns = router.urls
