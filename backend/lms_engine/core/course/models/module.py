import uuid

from django.db import models

from ...utils.models import TimestampMixin
from . import Course
from ..constants import MODULE_TITLE_MAX_LEN, MODULE_DESCRIPTION_MAX_LEN


# Module model
class Module(TimestampMixin, models.Model):
    """
    Represents a module within a course.

    Attributes:
        course (ForeignKey): The course this module belongs to.
        title (str): The title of the module.
        description (str): A detailed description of the module.
        sequence (int): The order of the module within the course.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name="modules")
    title = models.CharField(max_length=MODULE_TITLE_MAX_LEN)
    description = models.TextField(max_length=MODULE_DESCRIPTION_MAX_LEN)
    sequence = models.PositiveIntegerField(
        help_text="The order of this module in the course."
    )

    class Meta:
        constraints = [
            # Ensure that each module within a course has a unique sequence number
            models.UniqueConstraint(
                fields=["course", "sequence"], name="module_sequence_in_course"
            )
        ]
        ordering = ["sequence"]  # Default ordering by sequence

    def __str__(self):
        """
        Returns a string representation of the module, including its sequence and title.
        """
        return f"Module {self.sequence}: {self.title}"
