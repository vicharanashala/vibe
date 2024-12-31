from django.db import models

from ..auth.permissions import ModelPermissionsMixin
from ..utils.models import TimestampMixin
from ..user.models import User
from . import constants as ct


class Institution(TimestampMixin, ModelPermissionsMixin, models.Model):
    name = models.CharField(max_length=ct.INSTITUTION_NAME_MAX_LEN, unique=True)
    description = models.TextField(
        null=True, blank=True, max_length=ct.INSTITUTION_DESCRIPTION_MAX_LEN
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
        return self.name

    def _has_access(self, user: User):
        return user.institutions.filter(pk=self.pk).exists()

    def student_has_access(self, user: User):
        return (self._has_access(user), False, False)

    def instructor_has_access(self, user: User):
        return (self._has_access(user), False, False)

    def staff_has_access(self, user: User):
        return (self._has_access(user), False, False)

    def moderator_has_access(self, user: User):
        has_access = self._has_access(user)
        return (has_access, has_access, False)

    def admin_has_access(self, user: User):
        return (True, True, False)
