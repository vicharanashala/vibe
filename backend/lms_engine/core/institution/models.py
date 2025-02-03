import uuid

from django.db import models

from core.utils.models import TimestampMixin


class Institution(TimestampMixin, models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=1000, unique=True)
    description = models.TextField(
        null=True, blank=True, max_length=3000
    )
    parent = models.ForeignKey(
        "self",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="children",
    )
    is_active = models.BooleanField(default=False)


    def __str__(self):
        return self.name + (" (active)" if self.is_active else "(inactive)")
