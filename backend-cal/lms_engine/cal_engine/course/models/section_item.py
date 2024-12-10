from django.db import models

from enum import Enum

from . import Section


class ItemTypeChoices(Enum):
    ARTICLE = 'article'
    ASSESSMENT = 'assessment'
    VIDEO = 'video'

    @classmethod
    def choices(cls):
        return [(key.value, key.name.title()) for key in cls]

class SectionItem(models.Model):
    section = models.ForeignKey(
        Section,
        on_delete=models.CASCADE,
        related_name="%(class)s_items",  # Dynamically generate related_name
        help_text="The section this item belongs to."
    )
    item_type = models.CharField(choices=ItemTypeChoices.choices(), max_length=10)
    sequence = models.PositiveIntegerField(help_text="The order of this item within the section.")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['section', 'sequence'],
                name='%(class)s_sequence_in_section'
            )
        ]
        ordering = ['sequence']
        abstract = True

    def __str__(self):
        return f"{self.section} - Item Sequence {self.sequence}"
