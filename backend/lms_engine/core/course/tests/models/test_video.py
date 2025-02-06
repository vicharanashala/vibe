# tests/models/test_video.py
from django.core.exceptions import ValidationError
from django.db.utils import IntegrityError
from django.test import TestCase

from core.course.models import Source, Video
from core.course.tests.factories import UserFactory


class TestVideo(TestCase):
    def setUp(self):
        self.source = Source.objects.create(url="https://example.com/video")
        self.video = Video.objects.create(
            source=self.source, transcript="Test transcript", start_time=0, end_time=60
        )
        self.admin_user = UserFactory(role="admin")

    def test_video_creation(self):
        self.assertIsInstance(self.video, Video)
        self.assertEqual(self.video.transcript, "Test transcript")
        self.assertEqual(self.video.start_time, 0)
        self.assertEqual(self.video.end_time, 60)

    def test_unique_segment_constraint(self):
        with self.assertRaises(IntegrityError):
            Video.objects.create(
                source=self.source, start_time=0, end_time=60  # Same time segment
            )

    def test_admin_access(self):
        read, write, delete = self.video.admin_has_access(self.admin_user)
        self.assertTrue(all([read, write, delete]))
