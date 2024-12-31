from django.db import models

from . import Question
from ..constants import QUESTION_OPTION_TEXT_MAX_LEN

class QuestionOption(models.Model):
    option_text = models.TextField(max_length=QUESTION_OPTION_TEXT_MAX_LEN)
    question = models.ForeignKey(Question, on_delete=models.CASCADE, related_name='options')
