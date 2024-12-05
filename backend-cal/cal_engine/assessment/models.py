from django.db import models
from django.core.exceptions import ValidationError
from django.contrib.contenttypes.models import ContentType
from django.contrib.contenttypes.fields import GenericForeignKey
from django.db import transaction
from django.db.models.signals import post_save
from django.dispatch import receiver
import re


class Assessment(models.Model):
    title = models.CharField(max_length=255)
    course = models.ForeignKey('course.Course', on_delete=models.CASCADE)
    type = models.CharField(max_length=50, choices=[('normal', 'Normal'), ('video', 'Video')])
    type = models.CharField(max_length=50, choices=[('normal', 'Normal'), ('video', 'Video')])
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
    marks = models.PositiveIntegerField(help_text="Maximum marks for the question.", default=1)
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
        # Check if the value type is 'float'
        if self.value_type == 'float':
            # Ensure decimal precision is not null
            if self.decimal_precision is None:
                raise ValidationError("Decimal precision is required when value_type is 'float'.")

            # Helper function to validate adherence to decimal precision
            def validate_decimal_precision(number, precision):
                decimal_part = str(number).split(".")[-1] if "." in str(number) else ""
                return len(decimal_part) <= precision

            # Validate `value`, `tolerance_min`, and `tolerance_max`
            if not validate_decimal_precision(self.value, self.decimal_precision):
                raise ValidationError(f"The 'value' does not adhere to the decimal precision of {self.decimal_precision}.")

            if self.tolerance_min is not None and not validate_decimal_precision(self.tolerance_min, self.decimal_precision):
                raise ValidationError(f"The 'tolerance_min' does not adhere to the decimal precision of {self.decimal_precision}.")

            if self.tolerance_max is not None and not validate_decimal_precision(self.tolerance_max, self.decimal_precision):
                raise ValidationError(f"The 'tolerance_max' does not adhere to the decimal precision of {self.decimal_precision}.")

            if self.tolerance_min is not None and self.tolerance_max is not None:
                if self.tolerance_min > self.tolerance_max:
                    raise ValidationError("tolerance_min cannot be greater than tolerance_max.")

    def save(self, *args, **kwargs):
        if self.value != 0:
            if self.tolerance_min is None:
                self.tolerance_min = self.value * 0.99  # -1%
            if self.tolerance_max is None:
                self.tolerance_max = self.value * 1.01  # +1%
        super().save(*args, **kwargs)


    def __str__(self):
        return self.text
    
class ChoiceSolution(models.Model):
    FORMAT_CHOICES = [
        ('text', 'Text'),
        ('image', 'Image'),
    ]

    question = models.ForeignKey(
        'Question',
        on_delete=models.CASCADE,
        related_name='choice_solutions',
        help_text="Link to the related question."
    )
    format = models.CharField(max_length=10, choices=FORMAT_CHOICES, default='text', help_text="Format of the option (text or image).")
    value = models.TextField(help_text="The text or image url for the option.")
    is_correct = models.BooleanField(default=False, help_text="Is this the correct option?")

    def clean(self):
        # Ensure 'value' is not empty depending on the format
        if self.format == 'text' and not self.value.strip():
            raise ValidationError("Text value cannot be empty when format is 'text'.")
        
        if self.format == 'image':
            # Optionally, you can validate if the URL is a valid image URL
            image_url_pattern = r'^(https?://.*\.(?:png|jpg|jpeg|gif|bmp|tiff))$'
            if not re.match(image_url_pattern, self.value.strip()):
                raise ValidationError("Invalid image URL format.")

    
    def __str__(self):
        return f"Answer for Question: {self.question.text}"