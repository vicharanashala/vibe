# core/course/tests/permissions/test_course_permissions.py

from django.test import TestCase
from core.course.tests.factories.user import UserFactory
from core.course.tests.factories.course import CourseFactory


class TestCoursePermissions(TestCase):
    def test_role_based_permissions(self):
        test_cases = [
            ('student', (True, False, False)),
            ('instructor', (True, True, False)),
            ('admin', (True, True, False))
        ]

        for role, expected_access in test_cases:
            with self.subTest(role=role):
                user = UserFactory(role=role)
                course = CourseFactory()
                if role == 'student':
                    access = course.student_has_access(user)
                elif role == 'instructor':
                    access = course.instructor_has_access(user)
                elif role == 'admin':
                    access = course.admin_has_access(user)
                assert access == expected_access