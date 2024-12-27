from django.db import models

from . import Question
from ..constants import SOLUTION_EXPLANATION_MAX_LEN


class Solution(models.Model):
    solution_explanation = models.TextField(max_length=SOLUTION_EXPLANATION_MAX_LEN)
    question = models.OneToOneField(
        Question, on_delete=models.CASCADE, related_name="%(class)s"
    )

    class Meta:
        abstract = True
