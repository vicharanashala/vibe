import factory
from django.contrib.auth import get_user_model
from factory.django import DjangoModelFactory

from core.user.models import Roles

User = get_user_model()


class UserFactory(DjangoModelFactory):
    class Meta:
        model = User
        # Skip duplicate usernames by trying new ones
        django_get_or_create = ("email",)

    # Basic user information
    email = factory.LazyAttribute(lambda obj: f"testuser_{obj}@example.com")
    password = factory.PostGenerationMethodCall("set_password", "testpass123")
    first_name = factory.Faker("first_name")
    last_name = factory.Faker("last_name")

    # Default role
    role = Roles.STUDENT  # Default to student role
    is_active = True
    is_staff = False
    is_superuser = False

    # Define different user types using factory traits
    class Params:
        # Traits for different user roles
        is_student = factory.Trait(
            role=Roles.STUDENT, is_staff=False, is_superuser=False
        )

        is_instructor = factory.Trait(
            role=Roles.INSTRUCTOR, is_staff=True, is_superuser=False
        )

        is_admin = factory.Trait(role=Roles.ADMIN, is_staff=True, is_superuser=True)

        is_moderator = factory.Trait(
            role=Roles.MODERATOR, is_staff=True, is_superuser=False
        )

    @factory.post_generation
    def institutions(self, create, extracted, **kwargs):
        """
        Handle many-to-many relationship with institutions.
        Usage: UserFactory(institutions=[institution1, institution2])
        """
        if not create or not extracted:
            return

        for institution in extracted:
            self.institutions.add(institution)

    @factory.post_generation
    def courses(self, create, extracted, **kwargs):
        """
        Handle many-to-many relationship with courses.
        Usage: UserFactory(courses=[course1, course2])
        """
        if not create or not extracted:
            return

        for course in extracted:
            self.courses.add(course)
