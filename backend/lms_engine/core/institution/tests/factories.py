# tests/factories.py
import factory
from factory.django import DjangoModelFactory
from core.institution.models import Institution

class InstitutionFactory(DjangoModelFactory):
    class Meta:
        model = Institution

    name = factory.Sequence(lambda n: f'Test Institution {n}')
    description = factory.Faker('paragraph')
    is_active = True
    
    @factory.post_generation
    def with_parent(self, create, extracted, **kwargs):
        if not create or not extracted:
            return
            
        self.parent = InstitutionFactory()

class UserFactory(DjangoModelFactory):
    class Meta:
        model = 'user.User'  # Use the actual user model path
    email = factory.LazyAttribute(lambda obj: f'testinstitute_{obj}@example.com')
    is_active = True

    @factory.post_generation
    def institutions(self, create, extracted, **kwargs):
        if not create:
            return
            
        if extracted:
            for institution in extracted:
                self.institutions.add(institution)