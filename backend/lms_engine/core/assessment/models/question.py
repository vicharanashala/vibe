from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator

from ...auth.permissions import ModelPermissionsMixin
from ...utils.models import TimestampMixin
from .. import constants as ct


class QuestionType(models.TextChoices):
    MCQ = "MCQ", "Multiple Choice Question"
    MSQ = "MSQ", "Multiple Select Question"
    NAT = "NAT", "Numerical Answer Type"
    DESC = "DESC", "Descriptive Question"


class Question(TimestampMixin, ModelPermissionsMixin, models.Model):
    assessment = models.ForeignKey(
        "Assessment", on_delete=models.CASCADE, related_name="questions"
    )
    text = models.TextField(max_length=ct.QUESTION_TEXT_MAX_LEN)
    hint = models.TextField(null=True, blank=True, max_length=ct.QUESTION_HINT_MAX_LEN)
    type = models.CharField(choices=QuestionType.choices)
    partial_marking = models.BooleanField(default=False, null=True)
    marks = models.IntegerField(
        validators=[
            MinValueValidator(ct.QUESTION_MARKS_MIN_VAL),
            MaxValueValidator(ct.QUESTION_MARKS_MAX_VAL),
        ]
    )

    def __getattr__(self, name):
        """
        Delegate permission checks to the related assessment object.
        """
        if name.endswith("_has_access"):
            return getattr(self.assessment, name)
        raise AttributeError(
            f"'{type(self).__name__}' object has no attribute '{name}'"
        )
