# core/institutions/utils.py
from core.institution.models import Institution, UserInstitution


def assign_user_to_institution(user, institution_name):
    """Assign a user to an institution."""
    institution = Institution.objects.get(name=institution_name)
    UserInstitution.objects.get_or_create(user=user, institution=institution)
    return f"User {user.email} added to institution {institution.name}"
