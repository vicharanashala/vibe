from django.db import models

from . import Section
from ..constants import ARTICLE_MAX_LENGTH
import uuid

from ...utils.models import TimestampMixin


class Article(TimestampMixin, models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    content = models.TextField(max_length=ARTICLE_MAX_LENGTH)
    section = models.ForeignKey(Section, on_delete=models.SET_NULL, null=True, blank=True)
    sequence = models.PositiveIntegerField(null=True, blank=True)


