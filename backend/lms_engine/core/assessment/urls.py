from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .models import NATSolution
from .views import QuestionViewSet, get_solution_by_question
from .views.assessment import AssessmentViewSet
from .views.solution import (
    DescriptiveSolutionViewSet,
    NATSolutionViewSet,
    QuestionOptionViewSet,
)

router = DefaultRouter()
router.register(r"questions", QuestionViewSet)
router.register(r"solutions/options", QuestionOptionViewSet)


urlpatterns = [
    path("", include(router.urls)),
    path(
        "solutions/<uuid:question_id>/",
        get_solution_by_question,
        name="get_solution_by_question",
    ),
]
