from django.db import models

from . import SectionItem


class Video(SectionItem):
    source = models.ForeignKey('Source', on_delete=models.CASCADE)
    assessment = models.OneToOneField('assessment.Assessment', on_delete=models.CASCADE)
    transcript = models.TextField(null=True, blank=True)
    start_time = models.DateTimeField()
    end_time = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def save(self, *args, **kwargs):
        self.item_type = 'video'
        super().save(*args, **kwargs)
