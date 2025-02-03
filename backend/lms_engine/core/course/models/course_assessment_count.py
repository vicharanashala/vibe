import uuid

from django.db import models



class CourseAssessmentCount( models.Model):

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    course = models.OneToOneField(
        "course.Course", on_delete=models.CASCADE, related_name="assessment_count"
    )
    count = models.PositiveIntegerField(default=0)
