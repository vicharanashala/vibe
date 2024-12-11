from rest_framework.routers import DefaultRouter
from .views import AssessmentViewSet, QuestionViewSet

router = DefaultRouter()
router.register(r'assessments', AssessmentViewSet)
router.register(r'questions', QuestionViewSet)

urlpatterns = router.urls
