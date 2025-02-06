# core/assessment/models/assessment.py

import uuid

from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models

from ...course.models import Section, SectionItemInfo, SectionItemType
from ...utils.models import TimestampMixin
from .. import constants as ct


class Assessment(TimestampMixin, models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
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
    section = models.ForeignKey(
        Section, on_delete=models.SET_NULL, null=True, blank=True
    )
    sequence = models.PositiveIntegerField(null=True, blank=True)

    def save(self, *args, **kwargs):
        SectionItemInfo.section_item_save_logic(
            self, super(), SectionItemType.ASSESSMENT, args, kwargs
        )

    def delete(self, *args, **kwargs):
        SectionItemInfo.section_item_delete_logic(self, super(), args, kwargs)

    def __str__(self):
        return self.title
