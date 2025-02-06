# tests/test_models.py
from django.test import TestCase

from core.institution.models import Institution
from core.institution.tests.factories import InstitutionFactory, UserFactory


class TestInstitution(TestCase):
    def setUp(self):
        self.institution = InstitutionFactory()
        self.parent_institution = InstitutionFactory()
        self.user = UserFactory()

    def test_role_based_access_permissions(self):
        """Test access permissions for different user roles"""
        test_cases = [
            ("student", (False, False, False)),
            ("instructor", (False, False, False)),
            ("staff", (False, False, False)),
            ("moderator", (False, False, False)),
            ("admin", (True, True, False)),
        ]

        for role, expected_access in test_cases:
            with self.subTest(role=role):
                user = UserFactory(role=role, email=f"{role}@test.com")  # Unique email
                access = getattr(self.institution, f"{role}_has_access")(user)
                self.assertEqual(access, expected_access)
