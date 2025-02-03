import uuid

from django.db import models

from ...utils.models import TimestampMixin
from . import Module
from .. import constants as ct


# Section model
class Section(TimestampMixin, models.Model):
    """
    Represents a section within a module.

    Attributes:
        module (ForeignKey): The module this section belongs to.
        title (str): The title of the section.
        description (str): A detailed description of the section.
        sequence (int): The order of the section within the module.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    module = models.ForeignKey(
        Module, on_delete=models.CASCADE, related_name="sections"
    )
    title = models.CharField(max_length=ct.SECTION_TITLE_MAX_LEN)
    description = models.TextField(max_length=ct.SECTION_DESCRIPTION_MAX_LEN)
    sequence = models.PositiveIntegerField(
        help_text="The order of this section within the module."
    )

    class Meta:
        constraints = [
            # Ensure that each section within a module has a unique sequence number
            models.UniqueConstraint(
                fields=["module", "sequence"], name="section_sequence_in_module"
            )
        ]
        ordering = ["sequence"]  # Default ordering by sequence

    def __str__(self):
        """
        Returns a string representation of the section, including its sequence and module.
        """
        return f"Section {self.sequence}: {self.title} (Module {self.module.sequence})"