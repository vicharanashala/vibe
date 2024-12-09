from django.db import models
from django.core.exceptions import ValidationError
from cal_engine.course.models import SectionItem
from .QuestionGen import transcriptAndQueGen
from django.shortcuts import get_object_or_404
from cal_engine.course.models import Section


class Video(SectionItem):
    content_type = models.CharField(max_length=10, default="video")
    title = models.CharField(max_length=255)
    description = models.TextField(null=True, blank=True)
    link = models.URLField()
    youtube_id = models.CharField(max_length=255)

    def save(self, *args, **kwargs):
        a = self.link
        b = self.section.id
        c = self.sequence
        # Initialize the transcript and question generation object
        tqg = transcriptAndQueGen(a, b, c)
        self.youtube_id = tqg.extractVideoId()
        
        # If the YouTube ID is extracted successfully, populate the title and description
        if tqg.video_id:
            self.title = tqg.title
            self.description = tqg.description

        super().save(*args, **kwargs)

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
            models.UniqueConstraint(fields=['sequence'], name='unique_sequence_per_article')
        ]
    def __str__(self):
        return f"{self.video.title} - Segment: {self.title} (Sequence: {self.sequence})"

from django.dispatch import receiver
from django.db.models.signals import post_save
@receiver(post_save, sender=Video)
def process_video(sender, instance, created, **kwargs):
    if created:
        # Access instance attributes like link, section, and sequence
        link = instance.link
        section_id = instance.section.id
        sequence = instance.sequence

        # Automatically generate video segments and questions
        tqg = transcriptAndQueGen(link, section_id, sequence)
        tqg.generateQuestions()