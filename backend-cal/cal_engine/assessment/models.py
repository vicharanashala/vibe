from django.db import models
from django.core.exceptions import ValidationError
from django.contrib.contenttypes.models import ContentType
from django.contrib.contenttypes.fields import GenericForeignKey
from django.db import transaction
from django.db.models.signals import post_save
from django.dispatch import receiver


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
        ('NAT', 'Numerical Answer Type'),
        ('DESC', 'Descriptive Question')
    ]

    text = models.TextField()
    type = models.CharField(max_length=20, choices=QUESTION_TYPES)
    marks = models.PositiveIntegerField(help_text="Maximum marks for the question.", default=0)
    assessments = models.ManyToManyField('Assessment', related_name='questions', blank=True)
    tags = models.TextField(null=True, blank=True, help_text="Comma-separated tags for question segregation.")
    time_limit = models.PositiveIntegerField(null=True, blank=True, help_text="Time limit in seconds.")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.text

class NATSolution(models.Model):
    VALUE_TYPES = [
        ('int', 'Integer'),
        ('float', 'Float'),
    ]

    question = models.OneToOneField(
        'Question',
        on_delete=models.CASCADE,
        related_name='nat_solution',
        help_text="Link to the related question.",
        null=True,
    )
    value_type = models.CharField(max_length=10, choices=VALUE_TYPES, default='int', help_text="Type of numerical value (Integer or Float).")
    value = models.FloatField(help_text="The correct numerical value.")
    tolerance_min = models.FloatField(null=True, blank=True, help_text="Minimum acceptable value.")
    tolerance_max = models.FloatField(null=True, blank=True, help_text="Maximum acceptable value.")
    decimal_precision = models.PositiveIntegerField(null=True, blank=True, help_text="Decimal precision required for floats (leave blank for integers).")

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
        # Calculate default tolerances if not provided
        if self.tolerance_min is None:
            self.tolerance_min = self.value * 0.99  # -1%
        if self.tolerance_max is None:
            self.tolerance_max = self.value * 1.01  # +1%
        super().save(*args, **kwargs)

    def __str__(self):
        return f"Value: {self.value}, Tolerance: [{self.tolerance_min}, {self.tolerance_max}]"
    
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

    
    def __str__(self):
        return f"{self.value} (Correct: {self.is_correct}"

class DescSolution(models.Model):
    question = models.OneToOneField(
        'Question',
        on_delete=models.CASCADE,
        related_name='desc_solution',
        help_text="Link to the related question."
    )
    model_answer = models.TextField(
        help_text="The correct or model answer for the descriptive question."
    )
    max_word_limit = models.PositiveIntegerField(
        null=True,
        blank=True,
        help_text="Maximum allowed word count for the answer. Leave blank if unlimited."
    )
    min_word_limit = models.PositiveIntegerField(
        null=True,
        blank=True,
        help_text="Minimum required word count for the answer. Leave blank if no minimum."
    )

    def clean(self):
        """Validation for word limits."""
        if self.min_word_limit and self.max_word_limit:
            if self.min_word_limit > self.max_word_limit:
                raise ValidationError("Minimum word limit cannot be greater than the maximum word limit.")

    def __str__(self):
        return f"Model Answer: {self.model_answer[:50]}..."  # Display first 50 characters
