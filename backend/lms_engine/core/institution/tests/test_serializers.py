# tests/test_serializers.py
from django.test import TestCase

from core.institution.serializers import InstitutionSerializer
from core.institution.tests.factories import InstitutionFactory


class TestInstitutionSerializer(TestCase):
    def setUp(self):
        self.institution = InstitutionFactory()
        self.serializer = InstitutionSerializer(instance=self.institution)

    def test_contains_expected_fields(self):
        """Test serializer contains all expected fields"""
        data = self.serializer.data
        expected_fields = {"id", "name", "description", "parent", "is_active"}
        assert set(data.keys()) == expected_fields

    def test_parent_field_serialization(self):
        """Test parent field serialization"""
        parent = InstitutionFactory()
        child = InstitutionFactory(parent=parent)
        serializer = InstitutionSerializer(instance=child)
        assert serializer.data["parent"] == parent.id

    def test_serializer_validation(self):
        """Test serializer validation"""
        invalid_data = {
            "name": "A" * 300,  # Exceeds max length
            "description": "Test description",
            "is_active": True,
        }
        serializer = InstitutionSerializer(data=invalid_data)
        assert not serializer.is_valid()
        assert "name" in serializer.errors
