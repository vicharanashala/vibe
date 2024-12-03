from django.db import models
from django.core.exceptions import ValidationError
from django.contrib.contenttypes.models import ContentType
from django.contrib.contenttypes.fields import GenericForeignKey


class Assessment(models.Model):
    title = models.CharField(max_length=255)
    course = models.ForeignKey('course.Course', on_delete=models.CASCADE)
    type = models.CharField(max_length=50, choices=[('Quiz', 'Quiz'), ('Assignment', 'Assignment'), ('Exam', 'Exam')])
    deadline = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.title

class Question(models.Model):
    QUESTION_TYPES = [
        ('MCQ', 'Multiple Choice Question'),
        ('MSQ', 'Multiple Select Question'),
        ('NAT_INT', 'Numerical Answer Type (Integer)'),
        ('NAT_FLOAT', 'Numerical Answer Type (Float)'),
        ('DESC', 'Descriptive Question'),
    ]

    text = models.TextField()
    type = models.CharField(max_length=20, choices=QUESTION_TYPES)
    marks = models.PositiveIntegerField(help_text="Maximum marks for the question.", default=0)
    partial_marking = models.BooleanField(default=False, help_text="Allow partial marking for MSQ (if applicable).")
    assessments = models.ManyToManyField('Assessment', related_name='questions', blank=True)
    answer = models.TextField(null=True, blank=True, help_text="Store the correct answer. Format varies by type.")
    tolerance_min = models.FloatField(
        null=True, blank=True,
        help_text="Minimum acceptable value for NAT (Numerical Answer Type)."
    )
    tolerance_max = models.FloatField(
        null=True, blank=True,
        help_text="Maximum acceptable value for NAT (Numerical Answer Type)."
    )
    decimal_precision = models.PositiveIntegerField(
        null=True, blank=True,
        help_text="Decimal precision required for NAT_FLOAT. Leave blank for NAT_INT."
    )
    tags = models.TextField(null=True, blank=True, help_text="Comma-separated tags for question segregation.")
    time_limit = models.PositiveIntegerField(null=True, blank=True, help_text="Time limit in seconds.")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def clean(self):
        if self.type in ['NAT_INT', 'NAT_FLOAT']:
            if self.tolerance_min is None or self.tolerance_max is None:
                raise ValidationError("Tolerance values (min and max) are required for Numerical Answer Type questions.")
            if self.tolerance_min > self.tolerance_max:
                raise ValidationError("Tolerance min cannot be greater than tolerance max.")
            if self.type == 'NAT_FLOAT' and self.decimal_precision is None:
                raise ValidationError("Decimal precision is required for NAT_FLOAT questions.")
        else:
            if self.tolerance_min or self.tolerance_max or self.decimal_precision:
                raise ValidationError("Tolerance or precision values are not applicable for non-NAT questions.")

    def __str__(self):
        return self.text
    
class Answer(models.Model):
    question = models.ForeignKey('Question', on_delete=models.CASCADE, related_name="answers")
    content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE)
    object_id = models.PositiveIntegerField()
    content_object = GenericForeignKey('content_type', 'object_id')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Answer for Question: {self.question.text}"