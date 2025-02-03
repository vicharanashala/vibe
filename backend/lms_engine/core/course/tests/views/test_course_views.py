# tests/views/test_course_views.py
from rest_framework.test import APITestCase
from rest_framework import status
from core.course.tests.factories import CourseFactory, UserFactory
from core.course.models import VisibilityChoices
from core.institution.models import Institution  # Make sure to import this

class TestCourseViewSet(APITestCase):
    def setUp(self):
        self.user = UserFactory(role='instructor')
        self.client.force_authenticate(user=self.user)
        self.institution = Institution.objects.create(name="Test Institution")
        self.course = CourseFactory(institutions=[self.institution])
        self.list_url = '/api/courses/'
        self.detail_url = f'/api/courses/{self.course.id}/'

    def test_create_course(self):
        data = {
            'name': 'New Course',
            'description': 'Course Description',
            'visibility': VisibilityChoices.PUBLIC,
            'institutions': [self.institution.id], 
        }
        response = self.client.post(self.list_url, data)
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data['name'] == data['name']