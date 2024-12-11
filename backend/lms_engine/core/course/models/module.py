from django.db import models
from . import Course


class Module(models.Model):  # Higher-level grouping, replaces Week
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name='modules')
    title = models.CharField(max_length=255)
    description = models.TextField()
    sequence = models.PositiveIntegerField(help_text="The order of this module in the course.")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['course', 'sequence'],
                name='module_sequence_in_course'
            )
        ]
        ordering = ['sequence']

    def __str__(self):
        return f"Module {self.sequence}: {self.title}"
