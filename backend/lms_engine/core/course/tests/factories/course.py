# tests/factories/course.py
import factory
from factory.django import DjangoModelFactory

from core.course.models import Course

from .user import UserFactory


class CourseFactory(DjangoModelFactory):
    class Meta:
        model = Course

    name = factory.Sequence(lambda n: f"Test Course {n}")
    description = factory.Faker("paragraph")
    visibility = "public"

    @factory.post_generation
    def institutions(self, create, extracted, **kwargs):
        if not create:
            return
        if extracted:
            for institution in extracted:
                self.institutions.add(institution)

    @factory.post_generation
    def instructors(self, create, extracted, **kwargs):
        if not create:
            return
        if extracted:
            for instructor in extracted:
                self.instructors.add(instructor)
