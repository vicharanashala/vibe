from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.utils.translation import gettext_lazy as _

from .models import User, UserInstitution


class UserInstitutionInline(admin.TabularInline):
    """Inline admin to display and manage UserInstitution relationships."""

    model = User.institutions.through  # Specify the through model for ManyToManyField
    extra = 1  # Number of extra rows displayed by default
    verbose_name = "Institution"
    verbose_name_plural = "Institutions"


class UserInstitutionAdmin(admin.ModelAdmin):
    """Admin configuration for the UserInstitution model."""

    list_display = ("user", "institution", "created_at", "updated_at")
    search_fields = ("user__email", "institution__name")
    list_filter = ("institution",)
    ordering = ("user", "institution")


class UserAdmin(BaseUserAdmin):
    """Custom admin for the User model."""

    # Define the fields to be displayed in the admin interface
    list_display = ("email", "first_name", "last_name", "is_staff", "is_active")
    list_filter = ("is_staff", "is_superuser", "is_active", "groups")
    search_fields = ("email", "first_name", "last_name")
    ordering = ("email",)

    # Define the fieldsets for viewing and editing users
    fieldsets = (
        (None, {"fields": ("email", "password")}),
        (_("Personal Info"), {"fields": ("first_name", "last_name")}),
        (
            _("Permissions"),
            {
                "fields": (
                    "is_active",
                    "is_staff",
                    "is_superuser",
                    "groups",
                    "user_permissions",
                ),
            },
        ),
        (_("Important dates"), {"fields": ("last_login", "date_joined")}),
    )

    # Define the fields for adding a new user
    add_fieldsets = (
        (
            None,
            {
                "classes": ("wide",),
                "fields": (
                    "email",
                    "password1",
                    "password2",
                    "first_name",
                    "last_name",
                    "is_staff",
                    "is_active",
                ),
            },
        ),
    )

    # Inline for UserInstitution relationship
    inlines = [UserInstitutionInline]

    def save_model(self, request, obj, form, change):
        if not change:
            # Extract data from form
            email = form.cleaned_data["email"]
            password = form.cleaned_data["password1"]
            # Use your manager's create_user method
            User.objects.create_user(email=email, password=password)
        else:
            super().save_model(request, obj, form, change)


# Register the custom User model and the custom UserAdmin
admin.site.register(User, UserAdmin)
admin.site.register(UserInstitution, UserInstitutionAdmin)
