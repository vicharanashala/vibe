# # signals/video_signals.py
#
# import logging
# from django.db.models.signals import post_save
# from django.dispatch import receiver
# from ..models import Video
# from ..services import VideoService
#
# logger = logging.getLogger(__name__)
#
# @receiver(post_save, sender=Video)
# def video_post_save(sender, instance, created, **kwargs):
#     """After saving a Video, sync its SectionItemInfo."""
#     if created:
#         logger.debug("Video created: id=%s", instance.id)
#     else:
#         logger.debug("Video updated: id=%s", instance.id)
#
#     try:
#         VideoService.sync_section_item_info(instance)
#     except Exception as e:
#         logger.error("Error syncing SectionItemInfo for Video id=%s: %s", instance.id, e)
#         raise
