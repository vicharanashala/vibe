# tests/test_views.py
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from core.institution.tests.factories import InstitutionFactory, UserFactory


class TestInstitutionViewSet(APITestCase):
    def setUp(self):
        self.user = UserFactory(role="admin")
        self.client.force_authenticate(user=self.user)
        self.institution = InstitutionFactory()
        self.list_url = reverse("institution-list")
        self.detail_url = reverse(
            "institution-detail", kwargs={"pk": self.institution.pk}
        )

    def test_list_institutions(self):
        """Test GET request to list institutions"""
        response = self.client.get(self.list_url)
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) >= 1

    def test_create_institution(self):
        """Test POST request to create institution"""
        data = {
            "name": "New Institution",
            "description": "Test Description",
            "is_active": True,
        }
        response = self.client.post(self.list_url, data)
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data["name"] == data["name"]

    def test_retrieve_institution(self):
        """Test GET request to retrieve specific institution"""
        response = self.client.get(self.detail_url)
        assert response.status_code == status.HTTP_200_OK
        assert response.data["name"] == self.institution.name

    def test_update_institution(self):
        """Test PUT request to update institution"""
        data = {
            "name": "Updated Institution",
            "description": "Updated Description",
            "is_active": True,
        }
        response = self.client.put(self.detail_url, data)
        assert response.status_code == status.HTTP_200_OK
        assert response.data["name"] == data["name"]

    def test_partial_update_institution(self):
        """Test PATCH request to partially update institution"""
        data = {"name": "Partially Updated Institution"}
        response = self.client.patch(self.detail_url, data)
        assert response.status_code == status.HTTP_200_OK
        assert response.data["name"] == data["name"]

    # def test_destroy_deactivates_institution(self):
    #     """Test DELETE request deactivates instead of deleting institution"""
    #     response = self.client.delete(self.detail_url)
    #     assert response.status_code == status.HTTP_200_OK

    #     # Verify institution is deactivated but not deleted
    #     self.institution.refresh_from_db()
    #     assert self.institution.is_active is False

    def test_unauthorized_access(self):
        """Test unauthorized access to endpoints"""
        self.client.force_authenticate(user=None)
        response = self.client.get(self.list_url)
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
