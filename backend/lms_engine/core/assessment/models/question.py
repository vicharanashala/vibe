# core/assessment/models/question.py

import uuid

from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models

from ...utils.models import TimestampMixin
from .. import constants as ct


class QuestionType(models.TextChoices):
    MCQ = "MCQ", "Multiple Choice Question"
    MSQ = "MSQ", "Multiple Select Question"
    NAT = "NAT", "Numerical Answer Type"
    DESC = "DESC", "Descriptive Question"


class Question(TimestampMixin, models.Model):

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    assessment = models.ForeignKey(
        "assessment.Assessment", on_delete=models.CASCADE, related_name="questions"
    )
    text = models.TextField(
        max_length=ct.QUESTION_TEXT_MAX_LEN, help_text="The question text."
    )
    hint = models.TextField(
        null=True,
        blank=True,
        max_length=ct.QUESTION_HINT_MAX_LEN,
        help_text="A hint to help the student.",
    )
    type = models.CharField(
        choices=QuestionType.choices, max_length=10, help_text="The type of question."
    )
    partial_marking = models.BooleanField(
        default=False, null=True, help_text="Enable partial marking for the question."
    )
    marks = models.IntegerField(
        validators=[
            MinValueValidator(ct.QUESTION_MARKS_MIN_VAL),
            MaxValueValidator(ct.QUESTION_MARKS_MAX_VAL),
        ],
        help_text="The maximum marks for the question.",
    )

    def __getattr__(self, name):
        """
        Delegate permission checks to the related assessment object.
        Handles permission method lookups that are not directly defined on the Question model.
        """
        # List of permission methods to delegate to the assessment
        permission_methods = [
            "student_has_access",
            "instructor_has_access",
            "staff_has_access",
            "moderator_has_access",
            "admin_has_access",
            "superadmin_has_access",
        ]

        if name in permission_methods:
            # Delegate the permission check to the associated assessment
            return getattr(self.assessment, name)

        # If it's not a known permission method, raise the standard AttributeError
        raise AttributeError(
            f"'{type(self).__name__}' object has no attribute '{name}'"
        )

    # def admin_has_access(self, user: "User"):
    #     return True, True, True
