from django.db import models

from . import User

class UserInstitution(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    institution = models.ForeignKey('institution.Institution', on_delete=models.CASCADE)
    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['user', 'institution'], name='unique_user_institution')
        ]

    def __str__(self):
        return f"{self.user.first_name} - {self.institution.name}"


class UserCourseInstance(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    course = models.ForeignKey('course.CourseInstance', on_delete=models.CASCADE)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['user', 'course'], name='unique_user_course')
        ]

    def __str__(self):
        return f"{self.user.first_name} - {self.course.name}"
    
    def admin_has_access(self, user):
        """
        Define access rules for admins.
        """
        # Allow admins to read, write, and delete modules.
        return (True, True, False)
