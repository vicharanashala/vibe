from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.contrib.auth.models import Group

from .models import User, UserCourseInstance

class UserAdmin(BaseUserAdmin):
    list_display = ('email', 'name', 'role', 'is_active', 'is_staff')
    list_filter = ('role', 'is_active', 'is_staff', 'is_superuser')
    fieldsets = (
        (None, {'fields': ('email', 'password')}),
        ('Personal Info', {'fields': ('first_name', 'last_name')}),
        ('Permissions', {'fields': ('role', 'is_active', 'is_staff', 'is_superuser', 'user_permissions')}), 
        ('Important dates', {'fields': ('last_login', 'created_at', 'updated_at')}),  # Added to fieldsets
    )
    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': ('email', 'password1', 'password2', 'role', 'is_staff', 'is_superuser'),
        }),
    )
    search_fields = ('email',)
    ordering = ('email',)
    filter_horizontal = ('user_permissions',)

    # Mark created_at and updated_at as read-only fields
    readonly_fields = ('created_at', 'updated_at')

    def name(self, obj):
        return f'{obj.first_name} {obj.last_name}'

@admin.register(UserCourseInstance)
class UserCoursesAdmin(admin.ModelAdmin):
    list_display = ('user', 'course')
    search_fields = ('course__title',)

# Unregister the default Group model (optional)
admin.site.unregister(Group)

# Register the custom User model
admin.site.register(User, UserAdmin)

