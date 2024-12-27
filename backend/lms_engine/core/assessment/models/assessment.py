from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator

from ...course.models import SectionItem
from .. import constants as ct


class Assessment(SectionItem):
    title = models.CharField(max_length=ct.ASSESSMENT_TITLE_MAX_LEN)
    question_visibility_limit = models.IntegerField(
        validators=[
            MinValueValidator(ct.ASSESSMENT_QUESTION_VISIBILITY_LIMIT_MIN_VAL),
            MaxValueValidator(ct.ASSESSMENT_QUESTION_VISIBILITY_LIMIT_MAX_VAL),
        ]
    )
    time_limit = models.IntegerField(
        validators=[
            MinValueValidator(ct.ASSESSMENT_TIME_LIMIT_MIN_VAL),
            MaxValueValidator(ct.ASSESSMENT_TIME_LIMIT_MAX_VAL),
        ],
        help_text="Time limit in seconds",
    )
