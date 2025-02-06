# core/course/tests/factories/source.py

import factory

from core.course.models import Source


class SourceFactory(factory.django.DjangoModelFactory):
    """Factory for creating Source instances for testing."""

    class Meta:
        model = Source
        django_get_or_create = ("url",)

    url = factory.Sequence(lambda n: f"https://example.com/resource/{n}")
