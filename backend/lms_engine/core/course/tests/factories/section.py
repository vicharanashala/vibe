import factory
from factory.django import DjangoModelFactory
from core.course.models import Section
from faker import Faker
from core.course.tests.factories import ModuleFactory

fake = Faker()

class SectionFactory(DjangoModelFactory):
    class Meta:
        model = Section
        django_get_or_create = ('module', 'sequence')

    module = factory.SubFactory(ModuleFactory)
    title = factory.LazyFunction(lambda: fake.sentence(nb_words=4))
    description = factory.LazyFunction(lambda: fake.paragraph(nb_sentences=3))
    sequence = factory.Sequence(lambda n: n + 1)

    @classmethod
    def _create(cls, model_class, *args, **kwargs):
        """
        Override the _create method to handle the unique sequence constraint.
        If no sequence is provided, get the next available sequence number
        for the given module.
        """
        if 'sequence' not in kwargs:
            module = kwargs.get('module')
            if module:
                last_section = module.sections.order_by('-sequence').first()
                kwargs['sequence'] = (last_section.sequence + 1) if last_section else 1
        return super()._create(model_class, *args, **kwargs)