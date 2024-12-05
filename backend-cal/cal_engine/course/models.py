from django.db import models
from django.db import models
from django.contrib.contenttypes.models import ContentType
from django.contrib.contenttypes.fields import GenericForeignKey


class Course(models.Model):
    VISIBILITY_CHOICES = [
        ('public', 'Public'),
        ('private', 'Private'),
        ('unlisted', 'Unlisted'),
    ]
    VISIBILITY_CHOICES = [
        ('public', 'Public'),
        ('private', 'Private'),
        ('unlisted', 'Unlisted'),
    ]
    name = models.CharField(max_length=255, unique=True)
    image = models.ImageField(upload_to='course_images/', null=True, blank=True)
    description = models.TextField()
    visibility = models.CharField(
        max_length=50,
        choices=VISIBILITY_CHOICES,
        default='public',
        help_text="Set the visibility of the course."
    )
    institution = models.ForeignKey('institution.Institution', on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name


class Module(models.Model):  # Higher-level grouping, replaces Week
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name='modules')
    title = models.CharField(max_length=255)
    description = models.TextField()
    sequence = models.PositiveIntegerField(help_text="The order of this module in the course.")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('course', 'sequence')
        ordering = ['sequence']  # Default order by sequence

    def __str__(self):
        return f"Module {self.sequence}: {self.title}"


class Section(models.Model):  # Sub-parts within a Module
    module = models.ForeignKey(Module, on_delete=models.CASCADE, related_name='sections')
    title = models.CharField(max_length=255)
    description = models.TextField()
    sequence = models.PositiveIntegerField(help_text="The order of this section within the module.")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('module', 'sequence')
        ordering = ['sequence']  # Default order by sequence

    def __str__(self):
        return f"Section {self.sequence}: {self.title} (Module {self.module.sequence})"


class SectionItem(models.Model):
    section = models.ForeignKey(
        Section,
        on_delete=models.CASCADE,
        related_name="%(class)s_items",  # Dynamically generate related_name
        help_text="The section this item belongs to."
    )
    content_type = models.CharField(max_length=10)
    sequence = models.PositiveIntegerField(help_text="The order of this item within the section.")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('section', 'sequence')
        ordering = ['sequence']
        abstract = True

    def __str__(self):
        return f"{self.section} - Item Sequence {self.sequence}"


