from django.db import models

from . import SectionItem


class Article(SectionItem):
    content = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def save(self, *args, **kwargs):
        self.item_type = 'article'
        super().save(*args, **kwargs)
