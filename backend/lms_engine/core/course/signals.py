from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver

from ..assessment.models import Assessment
from .models import Course, CourseAssessmentCount


@receiver(post_save, sender=Assessment)
def update_assessment_count_on_save(sender, instance, created, **kwargs):
    if created:  # Only trigger when a new Assessment is created
        course = instance.section.module.course
        count_obj, _ = CourseAssessmentCount.objects.get_or_create(course=course)
        count_obj.count += 1
        count_obj.save()


@receiver(post_delete, sender=Assessment)
def update_assessment_count_on_delete(sender, instance, **kwargs):
    course = instance.section.module.course
    count_obj, _ = CourseAssessmentCount.objects.get_or_create(course=course)
    if count_obj.count > 0:
        count_obj.count -= 1
        count_obj.save()


@receiver(post_save, sender=Course)
def create_course_assessment_count(sender, instance, created, **kwargs):
    if created:
        CourseAssessmentCount.objects.get_or_create(course=instance)
