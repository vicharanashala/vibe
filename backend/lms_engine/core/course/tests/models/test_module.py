from django.core.exceptions import ValidationError
from django.db.utils import IntegrityError
from django.test import TestCase

from core.course.models import Module
from core.course.tests.factories import CourseFactory, ModuleFactory


class TestModule(TestCase):
    def setUp(self):
        self.course = CourseFactory()
        self.module = ModuleFactory(
            course=self.course,
            title="Test Module",
            description="Test Description",
            sequence=1,
        )

    def test_module_creation(self):
        self.assertIsInstance(self.module, Module)
        self.assertEqual(self.module.title, "Test Module")
        self.assertEqual(self.module.sequence, 1)

    def test_unique_sequence_constraint(self):
        with self.assertRaises(IntegrityError):
            Module.objects.create(
                course=self.course,
                title="Another Module",
                description="Another Description",
                sequence=1,  # Same sequence number
            )

    def test_ordering(self):
        module2 = ModuleFactory(course=self.course, sequence=2)
        modules = Module.objects.all()
        self.assertEqual(modules[0], self.module)
        self.assertEqual(modules[1], module2)
