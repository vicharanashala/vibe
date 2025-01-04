from django.db import models

from ...auth.permissions import ModelPermissionsMixin
from ...utils.models import TimestampMixin
from . import Course
from ..constants import MODULE_TITLE_MAX_LEN, MODULE_DESCRIPTION_MAX_LEN


class ModuleManager(models.Manager):
    def accessible_by(self, user):
        return self.filter(course__in=Course.objects.accessible_by(user))


class Module(TimestampMixin, ModelPermissionsMixin, models.Model):
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name="modules")
    title = models.CharField(max_length=MODULE_TITLE_MAX_LEN)
    description = models.TextField(max_length=MODULE_DESCRIPTION_MAX_LEN)
    sequence = models.PositiveIntegerField(
        help_text="The order of this module in the course."
    )

    objects: ModuleManager = ModuleManager()

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["course", "sequence"], name="module_sequence_in_course"
            )
        ]
        ordering = ["sequence"]

    def __str__(self):
        return f"Module {self.sequence}: {self.title}"

    def __getattr__(self, name):
        """
        Delegate permission checks to the related course object.
        """
        if name.endswith("_has_access"):
            return getattr(self.course, name)
        raise AttributeError(
            f"'{type(self).__name__}' object has no attribute '{name}'"
        )
    def admin_has_access(self, user):
        """
        Define access rules for admins.
        """
        # Allow admins to read, write, and delete modules.
        return (True, True, False)
