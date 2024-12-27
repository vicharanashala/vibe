from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import AssessmentViewSet, QuestionViewSet, get_solution_by_question

router = DefaultRouter()
router.register(r'assessments', AssessmentViewSet)
router.register(r'questions', QuestionViewSet)

urlpatterns = [
    path('', include(router.urls)),
    path('solutions/<int:question_id>/', get_solution_by_question, name='get_solution_by_question'),
]
