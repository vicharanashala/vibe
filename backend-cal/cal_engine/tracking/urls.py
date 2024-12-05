from rest_framework.routers import DefaultRouter
from .views import StudySessionViewSet, SessionViolationViewSet, ChapterCompletionViewSet

router = DefaultRouter()
router.register(r'study-sessions', StudySessionViewSet)
router.register(r'session-violations', SessionViolationViewSet)
router.register(r'chapter-completions', ChapterCompletionViewSet)

urlpatterns = router.urls
