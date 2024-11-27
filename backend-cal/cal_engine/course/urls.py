from rest_framework.routers import DefaultRouter
from .views import CourseViewSet, ChapterViewSet, CourseChapterViewSet

router = DefaultRouter()
router.register(r'courses', CourseViewSet)
router.register(r'chapters', ChapterViewSet)
router.register(r'course-chapters', CourseChapterViewSet)

urlpatterns = router.urls
