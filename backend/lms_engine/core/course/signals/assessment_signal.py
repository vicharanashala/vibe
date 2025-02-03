# from django.db.models.signals import post_save
# from django.dispatch import receiver
# from ..services import AssessmentService
# from ...assessment.models import Assessment
#

# @receiver(post_save, sender=Assessment)
# def assessment_post_save(sender, instance, created, **kwargs):
#     """
#     After saving a Video, sync the SectionItemInfo row.
#     """
#     AssessmentService.sync_section_item_info(instance)
