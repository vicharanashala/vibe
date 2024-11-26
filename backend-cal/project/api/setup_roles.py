from django.core.management.base import BaseCommand
from django.contrib.auth.models import Group, Permission
from django.contrib.contenttypes.models import ContentType
from functools import wraps
from django.http import HttpResponseForbidden

class Command(BaseCommand):
    help = 'Setup roles and permissions'

    def handle(self, *args, **kwargs):
        # Define roles and their permissions
        roles_permissions = {
            'Super Admin': {
                'permissions': 'all'  # Grant all permissions
            },
            'Admin': {
                'permissions': [
                    'add_institution', 'change_institution', 'delete_institution',
                    'add_course', 'change_course', 'delete_course',
                    'add_moderator', 'change_moderator', 'delete_moderator'
                ]
            },
            'Moderator': {
                'permissions': [
                    'add_coursegroup', 'change_coursegroup', 'delete_coursegroup',
                    'add_program', 'change_program', 'delete_program'
                ]
            },
            'Instructor': {
                'permissions': [
                    'add_coursecontent', 'change_coursecontent', 'delete_coursecontent',
                    'add_assessment', 'change_assessment', 'delete_assessment',
                    'add_video', 'change_video', 'delete_video',
                    'add_staff', 'change_staff', 'delete_staff',
                    'add_student', 'change_student', 'delete_student'
                ]
            },
            'Staff': {
                'permissions': [
                    'add_coursecontent', 'change_coursecontent', 'delete_coursecontent',
                    'add_assessment', 'change_assessment', 'delete_assessment',
                    'add_video', 'change_video', 'delete_video',
                    'add_student', 'change_student', 'delete_student'
                ]
            },
            'Student': {
                'permissions': [
                    'view_coursecontent', 'view_assessment', 'submit_assessment'
                ]
            }
        }

        # Create roles and assign permissions
        for role, data in roles_permissions.items():
            group, created = Group.objects.get_or_create(name=role)
            if data['permissions'] == 'all':
                # Assign all permissions
                group.permissions.set(Permission.objects.all())
            else:
                # Assign specific permissions
                permissions = Permission.objects.filter(codename__in=data['permissions'])
                group.permissions.set(permissions)
            group.save()

        self.stdout.write(self.style.SUCCESS('Roles and permissions setup completed!'))

# Decorators for role-based access control
def role_required(role):
    def decorator(view_func):
        @wraps(view_func)
        def _wrapped_view(request, *args, **kwargs):
            if not request.user.groups.filter(name=role).exists():
                return HttpResponseForbidden()
            return view_func(request, *args, **kwargs)
        return _wrapped_view
    return decorator

# Specific role decorators
super_admin_required = role_required('Super Admin')
admin_required = role_required('Admin')
moderator_required = role_required('Moderator')
instructor_required = role_required('Instructor')
staff_required = role_required('Staff')
student_required = role_required('Student')