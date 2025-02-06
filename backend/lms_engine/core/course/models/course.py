# core/course/models/course.py
import uuid
from typing import TYPE_CHECKING

from django.core.exceptions import ValidationError
from django.db import models
from django.db.models import Q

from ...utils.models import TimestampMixin
from ..constants import COURSE_DESCRIPTION_MAX_LEN, COURSE_NAME_MAX_LEN

if TYPE_CHECKING:
    from ...users.models import User


class VisibilityChoices(models.TextChoices):

    PUBLIC = "public", "Public"  # Publicly visible courses
    PRIVATE = "private", "Private"  # Only visible within certain institutions
    UNLISTED = "unlisted", "Unlisted"  # Hidden courses that require a direct link


class Course(TimestampMixin, models.Model):

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=COURSE_NAME_MAX_LEN)
    description = models.TextField(max_length=COURSE_DESCRIPTION_MAX_LEN)
    visibility = models.CharField(
        choices=VisibilityChoices.choices,
        default=VisibilityChoices.PUBLIC,
        help_text="Set the visibility of the course.",
        max_length=21,
    )
    institutions = models.ManyToManyField(
        "institution.Institution", related_name="courses"
    )
    instructors = models.ManyToManyField(
        "users.User", through="CourseInstructor", related_name="instructor_courses"
    )

    def __str__(self):
        return self.name


class CourseInstructor(models.Model):

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    course = models.ForeignKey(Course, on_delete=models.CASCADE)
    instructor = models.ForeignKey("users.User", on_delete=models.CASCADE)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["course", "instructor"], name="unique_course_instructor"
            )
        ]

    def __str__(self):
        return f"{self.instructor} - {self.course}"
