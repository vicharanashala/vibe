# tests/models/test_source.py
from django.test import TestCase

from core.course.models import Source


class TestSource(TestCase):
    def setUp(self):
        self.source = Source.objects.create(url="https://example.com/video")

    def test_source_creation(self):
        self.assertIsInstance(self.source, Source)
        self.assertEqual(self.source.url, "https://example.com/video")

    def test_url_as_primary_key(self):
        self.assertEqual(str(self.source.pk), "https://example.com/video")
