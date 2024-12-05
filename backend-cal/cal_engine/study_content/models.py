from django.db import models
from django.core.exceptions import ValidationError
from cal_engine.course.models import SectionItem

class Video(SectionItem):
    content_type = models.CharField(max_length=10, default="video")
    title = models.CharField(max_length=255)
    description = models.TextField(null=True, blank=True)
    link = models.URLField()
    youtube_id = models.CharField(max_length=255)

    def __str__(self):
        return self.title


class VideoSegment(models.Model):
    video = models.ForeignKey(Video, on_delete=models.CASCADE, related_name='segments')
    title = models.CharField(max_length=255)
    start_time = models.PositiveIntegerField(help_text="Start time in seconds", blank=True, null=True)
    transcript = models.TextField(null=True, blank=True)
    assessment = models.ForeignKey(
        'assessment.Assessment',
        on_delete=models.CASCADE,
        related_name='video_segment_assessment',
        null=True,
        blank=True
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.video.title} - Segment: {self.title}"

class Article(SectionItem):
    content_type = models.CharField(max_length=10, default="article")
    title = models.CharField(max_length=255)
    subtitle = models.CharField(max_length=255, null=True, blank=True)
    description = models.TextField()
    content = models.TextField(null=True, blank=True, help_text="Content for Markdown")

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['video', 'sequence'], name='unique_sequence_per_video')
        ]
    def __str__(self):
        return f"{self.video.title} - Segment: {self.title} (Sequence: {self.sequence})"

# class Article(models.Model):
#     CONTENT_TYPES = [
#         ('markdown', 'Markdown'),
#         ('pdf', 'PDF'),
#         ('link', 'Link'),
#     ]

#     module = models.ForeignKey('course.Module', on_delete=models.CASCADE, related_name='articles')
#     title = models.CharField(max_length=255)
#     subtitle = models.CharField(max_length=255, null=True, blank=True)
#     description = models.TextField()
#     content_type = models.CharField(max_length=50, choices=CONTENT_TYPES)
#     content = models.TextField(null=True, blank=True, help_text="Content for Markdown or link to PDF/URL")
#     created_at = models.DateTimeField(auto_now_add=True)
#     updated_at = models.DateTimeField(auto_now=True)

#     def __str__(self):
#         return self.title

