# tests/models/test_course_instance.py
from datetime import date

from django.core.exceptions import ValidationError
from django.db.utils import IntegrityError
from django.test import TestCase

from core.course.models import CourseInstance, CoursePersonnel
from core.course.tests.factories import (CourseFactory, CourseInstanceFactory,
                                         UserFactory)


class TestCourseInstance(TestCase):
    def setUp(self):
        self.course = CourseFactory()
        self.start_date = date(2024, 1, 1)
        self.end_date = date(2024, 6, 30)
        self.course_instance = CourseInstanceFactory(
            course=self.course, start_date=self.start_date, end_date=self.end_date
        )
        self.staff_user = UserFactory(role="staff")

    def test_course_instance_creation(self):
        self.assertIsInstance(self.course_instance, CourseInstance)
        self.assertEqual(self.course_instance.course, self.course)
        self.assertEqual(self.course_instance.start_date, self.start_date)
        self.assertEqual(self.course_instance.end_date, self.end_date)

    def test_unique_constraint(self):
        # Use create() instead of objects.create() to trigger validation
        duplicate_instance = CourseInstance(
            course=self.course, start_date=self.start_date, end_date=self.end_date
        )
        with self.assertRaises(IntegrityError):
            duplicate_instance.save()

    def test_staff_access(self):
        self.course_instance.personnel.add(self.staff_user)
        read, write, delete = self.course_instance.staff_has_access(self.staff_user)
        self.assertTrue(read)
        self.assertTrue(write)
        self.assertFalse(delete)


class TestCoursePersonnel(TestCase):
    def setUp(self):
        self.course_instance = CourseInstanceFactory()
        self.staff_user = UserFactory(role="staff")
        self.student_user = UserFactory(role="student")

    def test_valid_personnel_creation(self):
        personnel = CoursePersonnel(
            course=self.course_instance, personnel=self.staff_user
        )
        personnel.full_clean()  # Validate before saving
        personnel.save()
        self.assertIsInstance(personnel, CoursePersonnel)

    def test_invalid_personnel_role(self):
        personnel = CoursePersonnel(
            course=self.course_instance, personnel=self.student_user
        )
        with self.assertRaises(ValidationError):
            personnel.full_clean()  # This should raise ValidationError
