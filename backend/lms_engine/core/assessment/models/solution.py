# core/assessment/models/solution.py

import uuid

from django.db import models

from ..constants import SOLUTION_EXPLANATION_MAX_LEN
from . import Question


class Solution(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    solution_explanation = models.TextField(max_length=SOLUTION_EXPLANATION_MAX_LEN)
    question = models.OneToOneField(
        Question, on_delete=models.CASCADE, related_name="%(class)s"
    )

    class Meta:
        abstract = True
