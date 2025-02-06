from django.core.exceptions import ValidationError
from django.db.utils import IntegrityError
from django.test import TestCase

from core.course.models import Section
from core.course.tests.factories import ModuleFactory, SectionFactory


class TestSection(TestCase):
    def setUp(self):
        self.module = ModuleFactory()
        self.section = SectionFactory(
            module=self.module,
            title="Test Section",
            description="Test Description",
            sequence=1,
        )

    def test_section_creation(self):
        self.assertIsInstance(self.section, Section)
        self.assertEqual(self.section.title, "Test Section")
        self.assertEqual(self.section.sequence, 1)

    def test_unique_sequence_constraint(self):
        with self.assertRaises(IntegrityError):
            Section.objects.create(
                module=self.module,
                title="Another Section",
                description="Another Description",
                sequence=1,  # Same sequence number
            )

    def test_ordering(self):
        section2 = SectionFactory(module=self.module, sequence=2)
        sections = Section.objects.all()
        self.assertEqual(sections[0], self.section)
        self.assertEqual(sections[1], section2)
