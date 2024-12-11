# permissions.py
from rest_framework.permissions import BasePermission, SAFE_METHODS

class IsStudentReadOnly(BasePermission):
    """
    Custom permission to grant read-only access to students.
    """

    def has_permission(self, request, view):
        # Allow safe methods (GET, HEAD, OPTIONS) for students
        if request.user.role == 'student' and request.method in SAFE_METHODS:
            return True

        # Allow other roles full access
        if request.user.role != 'student':
            return True

        # Deny all other cases
        return False
