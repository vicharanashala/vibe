from django.db.models.signals import m2m_changed
from django.dispatch import receiver
from django.core.exceptions import ValidationError

from .models import User, Roles

COURSE_ROLES = [Roles.INSTRUCTOR, Roles.STUDENT, Roles.STAFF]

@receiver(m2m_changed, sender=User.institutions.through)
def validate_institutions(sender, instance, action, **kwargs):
    if action == "pre_add":
        # Check institution validation
        if instance.role == Roles.SUPERADMIN and instance.institutions.exists():
            raise ValidationError("Super Admin users cannot be assigned to any institution.")

@receiver(m2m_changed, sender=User.courses.through)
def validate_courses(sender, instance, action, **kwargs):
    """
    Enforce that only students can be associated with courses.
    """
    # Check courses validation
    if instance.role != Roles.STUDENT and instance.courses.exists():
        raise ValidationError(f"{instance.role} users cannot have associated courses.")

m2m_changed.connect(validate_institutions, sender=User.institutions.through)
