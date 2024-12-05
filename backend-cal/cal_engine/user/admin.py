from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.contrib.auth.models import Group
from .models import User, UserCourse

class UserAdmin(BaseUserAdmin):
    list_display = ('username', 'email', 'role', 'is_active', 'is_staff', 'is_superuser', 'created_at', 'updated_at')
    list_filter = ('role', 'is_active', 'is_staff', 'is_superuser')
    fieldsets = (
        (None, {'fields': ('username', 'email', 'password')}),
        ('Personal Info', {'fields': ('first_name', 'last_name', 'title')}),
        ('Permissions', {'fields': ('role', 'is_active', 'is_staff', 'is_superuser', 'user_permissions')}), 
        ('Important dates', {'fields': ('last_login', 'created_at', 'updated_at')}),  # Added to fieldsets
    )
    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': ('username', 'email', 'password1', 'password2', 'role', 'is_staff', 'is_superuser'),
        }),
    )
    search_fields = ('username', 'email')
    ordering = ('username',)
    filter_horizontal = ('user_permissions',)

    # Mark created_at and updated_at as read-only fields
    readonly_fields = ('created_at', 'updated_at')

@admin.register(UserCourse)
class UserCoursesAdmin(admin.ModelAdmin):
    list_display = ('user', 'course','start_date', 'end_date')
    list_filter = ('start_date', 'end_date')
    search_fields = ('user__username', 'course__title')

# Unregister the default Group model (optional)
admin.site.unregister(Group)

# Register the custom User model
admin.site.register(User, UserAdmin)

