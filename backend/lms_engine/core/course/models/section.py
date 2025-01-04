from django.db import models

from ...auth.permissions import ModelPermissionsMixin
from ...utils.models import TimestampMixin
from . import Module
from .. import constants as ct


class SectionManager(models.Manager):
    def accessible_by(self, user):
        return self.filter(module__in=Module.objects.accessible_by(user))


class Section(TimestampMixin, ModelPermissionsMixin, models.Model):
    module = models.ForeignKey(
        Module, on_delete=models.CASCADE, related_name="sections"
    )
    title = models.CharField(max_length=ct.SECTION_TITLE_MAX_LEN)
    description = models.TextField(max_length=ct.SECTION_DESCRIPTION_MAX_LEN)
    sequence = models.PositiveIntegerField(
        help_text="The order of this section within the module."
    )

    objects: SectionManager = SectionManager()

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["module", "sequence"], name="section_sequence_in_module"
            )
        ]
        ordering = ["sequence"]  # Default order by sequence

    def __str__(self):
        return f"Section {self.sequence}: {self.title} (Module {self.module.sequence})"

    def __getattr__(self, name):
        """
        Delegate permission checks to the related module object.
        """
        if name.endswith("_has_access"):
            return getattr(self.module, name)
        raise AttributeError(
            f"'{type(self).__name__}' object has no attribute '{name}'"
        )
    def admin_has_access(self, user):
        """
        Define access rules for admins.
        """
        # Allow admins to read, write, and delete modules.
        return (True, True, False)
