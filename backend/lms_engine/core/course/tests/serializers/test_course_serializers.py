# tests/serializers/test_course_serializers.py
from datetime import timedelta

from django.test import TestCase
from django.utils import timezone

from core.course.models import SectionItemType
from core.course.serializers import (ArticleSerializer, CourseDetailSerializer,
                                     CourseInstanceReadSerializer,
                                     CourseInstanceWriteSerializer,
                                     ModuleDetailSerializer,
                                     ModuleListSerializer,
                                     SectionDetailSerializer,
                                     SectionListSerializer, VideoSerializer)
from core.course.tests.factories import (CourseFactory, CourseInstanceFactory,
                                         ModuleFactory, SectionFactory,
                                         SourceFactory)


class TestCourseSerializer(TestCase):
    def setUp(self):
        self.course = CourseFactory()
        self.serializer = CourseDetailSerializer(instance=self.course)

    def test_contains_expected_fields(self):
        data = self.serializer.data
        expected_fields = {
            "course_id",
            "name",
            "description",
            "visibility",
            "module_count",
        }
        assert set(data.keys()) >= expected_fields

    def test_module_count_value(self):
        assert isinstance(self.serializer.data["module_count"], int)


class TestCourseInstanceSerializers(TestCase):
    def setUp(self):
        self.course = CourseFactory()
        self.course_instance = CourseInstanceFactory(course=self.course)
        self.read_serializer = CourseInstanceReadSerializer(
            instance=self.course_instance
        )
        self.valid_write_data = {
            "course_id": self.course.id,
            "start_date": timezone.now().date(),
            "end_date": (timezone.now() + timedelta(days=30)).date(),
        }

    def test_read_serializer_contains_expected_fields(self):
        data = self.read_serializer.data
        expected_fields = {"id", "course", "start_date", "end_date"}
        self.assertEqual(set(data.keys()), expected_fields)

    def test_read_serializer_course_data(self):
        data = self.read_serializer.data["course"]
        expected_course_fields = {"id", "name", "description"}
        self.assertEqual(set(data.keys()), expected_course_fields)

    def test_write_serializer_valid_data(self):
        serializer = CourseInstanceWriteSerializer(data=self.valid_write_data)
        self.assertTrue(serializer.is_valid())

    def test_write_serializer_invalid_dates(self):
        invalid_data = self.valid_write_data.copy()
        invalid_data["end_date"] = invalid_data["start_date"] - timedelta(days=1)
        serializer = CourseInstanceWriteSerializer(data=invalid_data)
        self.assertFalse(serializer.is_valid())


class TestModuleSerializers(TestCase):
    def setUp(self):
        self.module = ModuleFactory()
        self.list_serializer = ModuleListSerializer(instance=self.module)
        self.detail_serializer = ModuleDetailSerializer(instance=self.module)

    def test_list_serializer_fields(self):
        data = self.list_serializer.data
        expected_fields = {
            "module_id",
            "title",
            "description",
            "sequence",
            "created_at",
        }
        self.assertEqual(set(data.keys()), expected_fields)

    def test_detail_serializer_fields(self):
        data = self.detail_serializer.data
        self.assertIn("section_count", data)
        self.assertIsInstance(data["section_count"], int)

    def test_truncated_description(self):
        long_description = "x" * 300
        module = ModuleFactory(description=long_description)
        serializer = ModuleListSerializer(instance=module)
        self.assertLess(len(serializer.data["description"]), len(long_description))


# class TestSectionItemSerializers(TestCase):
#     def setUp(self):
#         self.section = SectionFactory()
#         self.source = SourceFactory()
#         self.video_data = {
#             'title': 'Test Video',
#             'description': 'Test Description',
#             'duration': 300,
#             'source': 'https://example.com/video',
#             'section': self.section.id,
#             'sequence': 1
#         }
#         self.article_data = {
#             'title': 'Test Article',
#             'content': 'Test Content',
#             'section': self.section.id,
#             'sequence': 1
#         }

#     def test_video_serializer_create(self):
#         serializer = VideoSerializer(data=self.video_data)
#         self.assertTrue(serializer.is_valid())
#         video = serializer.save()
#         self.assertEqual(video.title, self.video_data['title'])
#         self.assertTrue(hasattr(video, 'section_item_info'))
#         self.assertEqual(
#             video.section_item_info.item_type,
#             SectionItemType.VIDEO
#         )

#     def test_article_serializer_create(self):
#         serializer = ArticleSerializer(data=self.article_data)
#         self.assertTrue(serializer.is_valid())
#         article = serializer.save()
#         self.assertEqual(article.title, self.article_data['title'])
#         self.assertTrue(hasattr(article, 'section_item_info'))
#         self.assertEqual(
#             article.section_item_info.item_type,
#             SectionItemType.ARTICLE
#         )


class TestSectionSerializers(TestCase):
    def setUp(self):
        self.section = SectionFactory()
        self.list_serializer = SectionListSerializer(instance=self.section)
        self.detail_serializer = SectionDetailSerializer(instance=self.section)

    def test_list_serializer_fields(self):
        data = self.list_serializer.data
        expected_fields = {"id", "title", "description", "sequence", "created_at"}
        self.assertEqual(set(data.keys()), expected_fields)

    def test_detail_serializer_contains_all_fields(self):
        data = self.detail_serializer.data
        model_fields = [field.name for field in self.section._meta.fields]
        for field in model_fields:
            self.assertIn(field, data)
