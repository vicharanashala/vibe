from django.db import models
from django.core.exceptions import ValidationError
from django.db.models import Q

from ...auth.permissions import ModelPermissionsMixin
from ...utils.models import TimestampMixin
from ...user.models import User, Roles
from ..constants import COURSE_NAME_MAX_LEN, COURSE_DESCRIPTION_MAX_LEN


class VisibilityChoices(models.TextChoices):
    PUBLIC = "public", "Public"
    PRIVATE = "private", "Private"
    UNLISTED = "unlisted", "Unlisted"


class CourseManager(models.Manager):
    def accessible_by(self, user: User):
        if user.role in [Roles.SUPERADMIN, Roles.ADMIN]:
            return self.all()

        elif user.role == Roles.MODERATOR:
            return self.filter(
                institution_id__in=user.institutions.values_list("id", flat=True)
            )

        elif user.role == Roles.INSTRUCTOR:
            user_institutions = user.institutions.values_list("id", flat=True)

            return self.filter(
                Q(visibility=VisibilityChoices.PUBLIC)
                | Q(
                    institutions__id__in=user_institutions,
                    visibility=VisibilityChoices.PRIVATE,
                )
                | Q(instructors__contains=user)
            )

        elif user.role == Roles.STAFF:
            user_institutions = user.institutions.values_list("id", flat=True)

            return self.filter(
                Q(visibility=VisibilityChoices.PUBLIC)
                | Q(
                    institutions__id__in=user_institutions,
                    visibility=VisibilityChoices.PRIVATE,
                )
            ).union(
                user.personnel_courses.all()  # type: ignore
            )

        elif user.role == Roles.STUDENT:
            user_institutions = user.institutions.values_list("id", flat=True)

            return self.filter(
                Q(visibility=VisibilityChoices.PUBLIC)
                | Q(
                    institutions__id__in=user_institutions,
                    visibility=VisibilityChoices.PRIVATE,
                )
            ).union(user.courses.all())


class Course(TimestampMixin, ModelPermissionsMixin, models.Model):
    name = models.CharField(max_length=COURSE_NAME_MAX_LEN)
    description = models.TextField(max_length=COURSE_DESCRIPTION_MAX_LEN)
    visibility = models.CharField(
        choices=VisibilityChoices.choices,
        default=VisibilityChoices.PUBLIC,
        help_text="Set the visibility of the course.",
    )
    institutions = models.ManyToManyField(
        "institution.Institution", related_name="courses"
    )
    instructors = models.ManyToManyField(
        "user.User", through="CourseInstructor", related_name="instructor_courses"
    )

    objects: CourseManager = CourseManager()

    def __str__(self):
        return self.name

    def student_has_access(self, user: User):
        is_read_allowed = (
            user.courses.filter(course=self).exists()  # Enrolled courses
            or self.visibility == VisibilityChoices.PUBLIC
            or (
                self.visibility == VisibilityChoices.PRIVATE
                and self.institutions.intersection(user.institutions).exists()
            )  # Institution's private courses
        )

        return (is_read_allowed, False, False)

    def instructor_has_access(self, user: User):
        is_course_instructor = self.instructors.filter(pk=user.pk).exists()
        is_read_allowed = (
            is_course_instructor
            or self.visibility == VisibilityChoices.PUBLIC
            or (
                self.visibility == VisibilityChoices.PRIVATE
                and self.institutions.intersection(user.institutions).exists()
            )
        )

        return (is_read_allowed, is_course_instructor, False)

    def staff_has_access(self, user: User):
        is_course_staff = user.personnel_courses.filter(  # type: ignore
            pk=self.pk
        ).exists()
        is_read_allowed = (
            is_course_staff
            or self.visibility == VisibilityChoices.PUBLIC
            or (
                self.visibility == VisibilityChoices.PRIVATE
                and self.institutions.intersection(user.institutions).exists()
            )
        )

        return (is_read_allowed, False, False)

    def moderator_has_access(self, user: User):
        has_access = self.institutions.intersection(user.institutions).exists()

        return (has_access, has_access, False)

    def admin_has_access(self, user: User):
        return (True, True, False)


class CourseInstructor(models.Model):
    course = models.ForeignKey(Course, on_delete=models.CASCADE)
    instructor = models.ForeignKey("user.User", on_delete=models.CASCADE)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["course", "instructor"], name="unique_course_instructor"
            )
        ]

    def clean(self, *args, **kwargs):
        if self.instructor.role != "instructor":
            raise ValidationError(
                "Only users with the 'instructor' role can be added to the instructors."
            )
        super().clean(*args, **kwargs)

    def __str__(self):
        return f"{self.instructor} - {self.course}"
