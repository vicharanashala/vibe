from django.db import models

from enum import Enum

class VisibilityChoices(Enum):
    PUBLIC = 'public'
    PRIVATE = 'private'
    UNLISTED = 'unlisted'

    @classmethod
    def choices(cls):
        return [(key.value, key.name.title()) for key in cls]

PERSONNEL_ALLOWED_ROLES = ['moderator', 'staff', 'admin']


class Course(models.Model):
    name = models.CharField(max_length=255)
    description = models.TextField()
    visibility = models.CharField(
        max_length=50,
        choices=VisibilityChoices.choices(),
        default=VisibilityChoices.PUBLIC.value,
        help_text="Set the visibility of the course."
    )
    institutions = models.ManyToManyField('institution.Institution')
    instructors = models.ManyToManyField('user.User', through='CourseInstructor', related_name='instructors')
    personnel = models.ManyToManyField('user.User', through='CoursePersonnel', related_name='personnel')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name


class CourseInstructor(models.Model):
    course = models.ForeignKey(Course, on_delete=models.CASCADE)
    instructor = models.ForeignKey('user.User', on_delete=models.CASCADE)

    class Meta:
        unique_together = ('course', 'instructor')

    def save(self, *args, **kwargs):
        # Ensure only users with the 'instructor' role can be added
        if self.instructor.role not in PERSONNEL_ALLOWED_ROLES:
            raise ValueError(f"Only users with one of {', '.join([x for x in PERSONNEL_ALLOWED_ROLES])} role can be added to the instructors.")
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.instructor} - {self.course}"


class CoursePersonnel(models.Model):
    course = models.ForeignKey(Course, on_delete=models.CASCADE)
    personnel = models.ForeignKey('user.User', on_delete=models.CASCADE)

    class Meta:
        unique_together = ('course', 'personnel')

    def save(self, *args, **kwargs):
        # Ensure only users with the 'instructor' role can be added
        if self.personnel.role != 'instructor':
            raise ValueError("Only users with the 'instructor' role can be added to the instructors.")
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.personnel} - {self.course}"
