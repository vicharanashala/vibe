# tests/models/test_course_manager.py
from django.test import TestCase

from core.course.models import Course
from core.course.tests.factories import CourseFactory, UserFactory


class TestCourseManager(TestCase):
    def setUp(self):
        self.student = UserFactory(role="student")
        self.public_course = CourseFactory(visibility="public")
        self.private_course = CourseFactory(visibility="private")

    def test_accessible_by_student(self):
        courses = Course.objects.accessible_by(self.student)
        assert self.public_course in courses
        assert self.private_course not in courses
