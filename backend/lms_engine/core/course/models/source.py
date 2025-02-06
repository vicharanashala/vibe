from django.db import models


class Source(models.Model):
    url = models.URLField(primary_key=True)

    def __str__(self):
        return self.url
