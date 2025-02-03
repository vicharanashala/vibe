import uuid

from django.db import models
from django.core.exceptions import ValidationError
from ...utils.models import TimestampMixin
from ...users.models import User


# CourseInstance model
class CourseInstance(TimestampMixin, models.Model):
    """
    Represents a specific instance of a course, with start and end dates.

    Attributes:
        course (ForeignKey): The course this instance is related to.
        start_date (Date): The start date of the course instance.
        end_date (Date): The end date of the course instance.
        personnel (ManyToMany): Users assigned to this course instance as personnel.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    course = models.ForeignKey(
        "Course", on_delete=models.CASCADE, related_name="instances"
    )
    start_date = models.DateField()
    end_date = models.DateField()
    personnel = models.ManyToManyField(
        "users.User", through="CoursePersonnel", related_name="personnel_courses"
    )

    class Meta:
        constraints = [
            # Ensure unique course instances for the same course with the same start and end dates
            models.UniqueConstraint(
                fields=["course", "start_date", "end_date"],
                name="unique_course_instance",
            )
        ]

    def __str__(self):
        """
        Returns a string representation of the course instance, including the course and its start and end dates.
        """
        return f"{self.course} - {self.start_date} to {self.end_date}"


# Allowed roles for personnel
class PersonnelAllowedRoles(models.TextChoices):
    MODERATOR = "moderator", "Moderator"
    STAFF = "staff", "Staff"
    ADMIN = "admin", "Admin"

    @classmethod
    def choices_to_string(cls):
        """
        Returns a comma-separated string of allowed role names.
        """
        return ", ".join([choice[1] for choice in cls.choices])


# Through table for personnel-course relationships
class CoursePersonnel(models.Model):
    """
    Represents the relationship between a course instance and its personnel.

    Attributes:
        course (ForeignKey): The course instance the personnel is assigned to.
        personnel (ForeignKey): The personnel assigned to the course instance.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    course = models.ForeignKey(CourseInstance, on_delete=models.CASCADE)
    personnel = models.ForeignKey("users.User", on_delete=models.CASCADE)

    class Meta:
        constraints = [
            # Ensure unique personnel assignments for each course instance
            models.UniqueConstraint(
                fields=["course", "personnel"], name="unique_course_personnel"
            )
        ]

    def save(self, *args, **kwargs):
        """
        Validates the personnel's role before saving.

        Raises:
            ValidationError: If the personnel's role is not in the allowed roles.
        """
        if self.personnel.role not in PersonnelAllowedRoles.values:
            raise ValidationError(
                f"Only users with one of {PersonnelAllowedRoles.choices_to_string()} roles can be added as personnel."
            )
        super().save(*args, **kwargs)

    def __str__(self):
        """
        Returns a string representation of the personnel assignment.
        """
        return f"{self.personnel} - {self.course}"
