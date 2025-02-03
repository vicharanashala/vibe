# core/assessment/models/question_option.py

from django.db import models

from . import Question
from ..constants import QUESTION_OPTION_TEXT_MAX_LEN
import uuid

class QuestionOption(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    option_text = models.TextField(max_length=QUESTION_OPTION_TEXT_MAX_LEN)
    question = models.ForeignKey(Question, on_delete=models.CASCADE, related_name='options')

    def __str__(self):
        return str(self.id)