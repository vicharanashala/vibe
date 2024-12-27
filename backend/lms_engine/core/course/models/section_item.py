from django.db import models

from ...auth.permissions import ModelPermissionsMixin
from ...utils.models import TimestampMixin
from . import Section


class ItemTypeChoices(models.TextChoices):
    ARTICLE = "article", "Article"
    ASSESSMENT = "assessment", "Assessment"
    VIDEO = "video", "Video"


class SectionItem(TimestampMixin, ModelPermissionsMixin, models.Model):
    section = models.ForeignKey(
        Section,
        on_delete=models.CASCADE,
        related_name="%(class)ss",  # Dynamically generate related_name
        help_text="The section this item belongs to.",
    )
    item_type = models.CharField(choices=ItemTypeChoices.choices)
    sequence = models.PositiveIntegerField(
        help_text="The order of this item within the section."
    )

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["section", "sequence"], name="%(class)s_sequence_in_section"
            )
        ]
        ordering = ["sequence"]
        abstract = True

    def __str__(self):
        return f"{self.section} - Item Sequence {self.sequence}"

    def __getattr__(self, name):
        """
        Delegate permission checks to the related section object.
        """
        if name.endswith("_has_access"):
            return getattr(self.section, name)
        raise AttributeError(
            f"'{type(self).__name__}' object has no attribute '{name}'"
        )
