# tests/models/test_section_item.py
from django.core.exceptions import ValidationError
from django.db.utils import IntegrityError
from django.test import TestCase

from core.course.models import Article, SectionItemInfo, SectionItemType
from core.course.tests.factories import SectionFactory


class TestSectionItem(TestCase):
    def setUp(self):
        self.section = SectionFactory()
        self.article = Article.objects.create(content="Test content")
        self.section_item = SectionItemInfo.objects.create(
            section=self.section,
            sequence=1,
            item_type=SectionItemType.ARTICLE,
            item_id=self.article.id,
        )

    def test_section_item_creation(self):
        self.assertIsInstance(self.section_item, SectionItemInfo)
        self.assertEqual(self.section_item.item_type, SectionItemType.ARTICLE)
        self.assertEqual(self.section_item.sequence, 1)

    def test_unique_sequence_constraint(self):
        with self.assertRaises(IntegrityError):
            SectionItemInfo.objects.create(
                section=self.section,
                sequence=1,  # Same sequence number
                item_type=SectionItemType.VIDEO,
                item_id=1,
            )
