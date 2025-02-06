# signals/section_item_signals.py
#
# import logging
#
# from django.db import transaction
# from django.db.models import F
# from django.db.models.signals import pre_save, post_save, post_delete
# from django.dispatch import receiver
# from ..models import SectionItemInfo
# from ..services import SectionItemService
#
# logger = logging.getLogger(__name__)
#
# @receiver(pre_save, sender=SectionItemInfo)
# def section_item_pre_save(sender, instance: SectionItemInfo, **kwargs):
#     """Before saving SectionItemInfo, handle shifting logic."""
#     if instance.pk:
#         old_item = sender.objects.filter(pk=instance.pk).first()
#         logger.debug("Pre-save: Existing SectionItemInfo id=%s", instance.pk)
#     else:
#         old_item = None
#         logger.debug("Pre-save: New SectionItemInfo for item_id=%s", instance.item_id)
#
#     try:
#         sequence = instance.sequence
#         # If sequence is None, it will be handled in the service
#         if sequence is None:
#             SectionItemService.handle_pre_save(instance, old_item)
#         if sequence is not None:
#             logger.debug("SEE HERE HERE HERE Shifting items after sequence=%s", sequence)
#             # items = SectionItemInfo.objects.filter(sequence__gte=sequence)
#             # for i in items:
#             #     print(i.sequence)
#             # with transaction.atomic():
#             #     for item in items:
#             #         item.sequence += 1
#             #         item.save()
#             # for i in items:
#             #     print(i.sequence)
#             #
#
#     except Exception as e:
#         logger.error("Error in pre_save shifting logic: %s", e)
#         raise
#
# @receiver(post_save, sender=SectionItemInfo)
# def section_item_post_save(sender, instance, created, **kwargs):
#     """After saving SectionItemInfo, sync back to the item model."""
#     logger.debug("Post-save: SectionItemInfo id=%s", instance.pk)
#     try:
#         SectionItemService.sync_item_model(instance)
#     except Exception as e:
#         logger.error("Error in post_save syncing logic: %s", e)
#         raise
#
# @receiver(post_delete, sender=SectionItemInfo)
# def section_item_post_delete(sender, instance, **kwargs):
#     """After deleting SectionItemInfo, shift down items."""
#     logger.debug("Post-delete: SectionItemInfo id=%s", instance.pk)
#     try:
#         SectionItemService.handle_post_delete(instance)
#     except Exception as e:
#         logger.error("Error in post_delete shifting logic: %s", e)
#         raise


import logging

from django.db.models.signals import post_save
from django.dispatch import receiver

from core.assessment.models import Assessment
from core.course.models import SectionItemInfo, SectionItemType, Video


@receiver(post_save, sender=SectionItemInfo)
def handle_sequence_update(sender, instance: SectionItemInfo, created, **kwargs):
    """
    After saving SectionItemInfo, update the sequence of all items in the same section.
    """
    print("THISSSSSSS SIGNAL IS CALLLEDDDDDDD")
    if instance.item_type == SectionItemType.VIDEO:
        video = Video.objects.filter(id=instance.item_id).first()
        if video and video.sequence != instance.sequence:
            video.sequence = instance.sequence
            video.save()
        else:
            logging.error("Video with ID %s not found.", instance.item_id)
            return
    if instance.item_type == SectionItemType.ASSESSMENT:
        assessment = Assessment.objects.filter(id=instance.item_id).first()
        if assessment and assessment.sequence != instance.sequence:
            assessment.sequence = instance.sequence
            assessment.save()
        else:
            logging.error("Assessment with ID %s not found.", instance.item_id)
            return
