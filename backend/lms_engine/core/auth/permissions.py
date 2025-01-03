from django.db import models
from rest_framework.permissions import BasePermission, SAFE_METHODS

from typing import TYPE_CHECKING
if TYPE_CHECKING:
    from ..user.models import User


class ModelPermissionsMixin(models.Model):
    def student_has_access(self, user: "User"):
        return (False, False, False)

    def instructor_has_access(self, user: "User"):
        raise NotImplementedError

    def staff_has_access(self, user: "User"):
        raise NotImplementedError

    def moderator_has_access(self, user: "User"):
        raise NotImplementedError

    def admin_has_access(self, user: "User"):
        raise NotImplementedError

    def superadmin_has_access(self, user: "User"):
        return (True, True, True)

    class Meta:
        abstract = True


class RoleBasedPermission(BasePermission):
    def has_permission(self, request, view):
        from ..user.models import Roles

        print(request.user)
        print(view)

        
        # Check if it's a logout action
        is_logout_view = (
            view.__class__.__name__ == 'logout'   # For function-based views        
            )
        
        if request.user.role == Roles.STUDENT:
            return request.method in SAFE_METHODS or (request.method == "POST" and is_logout_view)
            
        return True
    
    def has_object_permission(self, request, view, obj: ModelPermissionsMixin):
        from ..user.models import Roles

        role: Roles = request.user.role

        is_read = request.method in SAFE_METHODS
        is_delete = request.method == "DELETE"
        is_write = not is_read and not is_delete

        if role == Roles.STUDENT:
            access = obj.student_has_access(request.user)

        elif role == Roles.INSTRUCTOR:
            access = obj.instructor_has_access(request.user)

        elif role == Roles.STAFF:
            access = obj.staff_has_access(request.user)

        elif role == Roles.MODERATOR:
            access = obj.moderator_has_access(request.user)

        elif role == Roles.ADMIN:
            access = obj.admin_has_access(request.user)

        elif role == Roles.SUPERADMIN:
            access = obj.superadmin_has_access(request.user)

        return access[0] if is_read else access[1] if is_write else access[2]
