import factory
from factory.django import DjangoModelFactory
from core.course.models import Module
from faker import Faker

fake = Faker()

class ModuleFactory(DjangoModelFactory):
    class Meta:
        model = Module
        django_get_or_create = ('course', 'sequence')

    course = factory.SubFactory('core.course.tests.factories.CourseFactory')
    title = factory.LazyFunction(lambda: fake.sentence(nb_words=4))
    description = factory.LazyFunction(lambda: fake.paragraph(nb_sentences=3))
    sequence = factory.Sequence(lambda n: n + 1)

    @classmethod
    def _create(cls, model_class, *args, **kwargs):
        """
        Override the _create method to handle the unique sequence constraint.
        If no sequence is provided, get the next available sequence number
        for the given course.
        """
        if 'sequence' not in kwargs:
            course = kwargs.get('course')
            if course:
                last_module = course.modules.order_by('-sequence').first()
                kwargs['sequence'] = (last_module.sequence + 1) if last_module else 1
        return super()._create(model_class, *args, **kwargs)