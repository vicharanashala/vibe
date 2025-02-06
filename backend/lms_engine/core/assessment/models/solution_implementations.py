# core/assessment/models/solution_implementations.py

import uuid

from django.db import models
from django.forms import ValidationError

from ..constants import MODEL_DESCRIPTIVE_SOLUTION_MAX_LEN
from . import Question, QuestionOption, Solution


class NATSolution(Solution):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    value = models.FloatField()
    tolerance_max = models.FloatField()
    tolerance_min = models.FloatField()
    decimal_precision = models.PositiveIntegerField()

    def clean(self):
        # Helper function to validate adherence to decimal precision
        def validate_decimal_precision(number, precision):
            decimal_part = str(number).split(".")[-1] if "." in str(number) else ""
            return len(decimal_part) <= precision

        # Validate `value`, `tolerance_min`, and `tolerance_max`
        if not validate_decimal_precision(self.value, self.decimal_precision):
            raise ValidationError(
                f"The 'value' does not adhere to the decimal precision of {self.decimal_precision}."
            )

        if self.tolerance_min is not None and not validate_decimal_precision(
            self.tolerance_min, self.decimal_precision
        ):
            raise ValidationError(
                f"The 'tolerance_min' does not adhere to the decimal precision of {self.decimal_precision}."
            )

        if self.tolerance_max is not None and not validate_decimal_precision(
            self.tolerance_max, self.decimal_precision
        ):
            raise ValidationError(
                f"The 'tolerance_max' does not adhere to the decimal precision of {self.decimal_precision}."
            )

        if self.tolerance_min is not None and self.tolerance_max is not None:
            if self.tolerance_min > self.tolerance_max:
                raise ValidationError(
                    "tolerance_min cannot be greater than tolerance_max."
                )

        return super().clean()


class DescriptiveSolution(Solution):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    model_solution = models.TextField(max_length=MODEL_DESCRIPTIVE_SOLUTION_MAX_LEN)
    max_word_limit = models.PositiveIntegerField(
        null=True,
        blank=True,
        help_text="Maximum allowed word count for the answer. Leave blank if unlimited.",
    )
    min_word_limit = models.PositiveIntegerField(
        null=True,
        blank=True,
        help_text="Minimum required word count for the answer. Leave blank if no minimum.",
    )

    def clean(self):
        """Validation for word limits."""
        if self.min_word_limit and self.max_word_limit:
            if self.min_word_limit > self.max_word_limit:
                raise ValidationError(
                    "Minimum word limit cannot be greater than the maximum word limit."
                )

        super().clean()


class MCQSolution(Solution):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    choice = models.OneToOneField(
        QuestionOption, on_delete=models.CASCADE, related_name="mcq_solution"
    )

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["question", "choice"], name="unique_mcq_choice"
            )
        ]


class MSQSolution(Solution):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    choice = models.OneToOneField(QuestionOption, on_delete=models.CASCADE)
    question = models.ForeignKey(Question, on_delete=models.CASCADE)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["question", "choice"], name="unique_msq_choice"
            )
        ]
