from rest_framework.routers import DefaultRouter
from .views import AssessmentViewSet, QuestionViewSet, QuestionOptionViewSet, AssessmentGradingViewSet

router = DefaultRouter()
router.register(r'assessments', AssessmentViewSet)
router.register(r'questions', QuestionViewSet)
router.register(r'question-options', QuestionOptionViewSet)
router.register(r'assessment-grading', AssessmentGradingViewSet)

urlpatterns = router.urls
