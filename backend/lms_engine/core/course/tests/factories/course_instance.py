# tests/factories/course_instance.py
import factory
from factory.django import DjangoModelFactory
from core.course.models import CourseInstance
from .course import CourseFactory
from .user import UserFactory

class CourseInstanceFactory(DjangoModelFactory):
    class Meta:
        model = CourseInstance

    course = factory.SubFactory(CourseFactory)
    start_date = factory.Faker('date_this_year')
    end_date = factory.Faker('date_this_year')

    @factory.post_generation
    def instructors(self, create, extracted, **kwargs):
        if not create:
            return
        if extracted:
            for instructor in extracted:
                self.instructors.add(instructor)

    @factory.post_generation
    def students(self, create, extracted, **kwargs):
        if not create:
            return
        if extracted:
            for student in extracted:
                self.students.add(student)
