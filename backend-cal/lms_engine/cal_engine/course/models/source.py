from django.db import models


class Source(models.Model):
    url = models.URLField(primary_key=True)
