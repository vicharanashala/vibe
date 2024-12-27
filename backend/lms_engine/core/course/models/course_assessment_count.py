from django.db import models

from ...auth.permissions import ModelPermissionsMixin


class CourseAssessmentCount(ModelPermissionsMixin, models.Model):
    course = models.OneToOneField(
        "course.Course", on_delete=models.CASCADE, related_name="assessment_count"
    )
    count = models.PositiveIntegerField(default=0)

    def __getattr__(self, name):
        """
        Delegate permission checks to the related course object.
        """
        if name.endswith("_has_access"):
            return getattr(self.course, name)
        raise AttributeError(
            f"'{type(self).__name__}' object has no attribute '{name}'"
        )
