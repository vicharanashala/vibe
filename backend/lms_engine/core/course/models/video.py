import uuid

from django.db import models, transaction
from django.db.models.aggregates import Max
from django.utils.translation.trans_real import translation

from . import Section, SectionItemInfo, SectionItemType
from ..constants import VIDEO_TRANSCRIPT_MAX_LEN
from ...utils.models import TimestampMixin


class Video(TimestampMixin, models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    source = models.ForeignKey(
        "Source", on_delete=models.CASCADE, related_name="videos"
    )
    transcript = models.TextField(
        null=True, blank=True, max_length=VIDEO_TRANSCRIPT_MAX_LEN,
        help_text="Transcript of the video."
    )
    start_time = models.PositiveIntegerField(help_text="Start time of the video in seconds.")
    end_time = models.PositiveIntegerField(help_text="End time of the video in seconds.")

    section = models.ForeignKey(Section, on_delete=models.SET_NULL, null=True, blank=True)
    sequence = models.PositiveIntegerField(null=True, blank=True)

    # def save(self, *args, **kwargs):
    #     previous = SectionItemInfo.objects.filter(item_id=self.pk).first()
    #     previous_sequence = previous.sequence if previous else None
    #     current_sequence = self.sequence
    #
    #     if previous is None:
    #         if current_sequence is None:
    #             max_sequence = SectionItemInfo.objects.aggregate(Max('sequence'))['sequence__max']
    #             self.sequence = max_sequence + 1 if max_sequence else 1
    #             super().save(*args, **kwargs)
    #             SectionItemInfo.create_item(self.section, self.sequence, SectionItemType.VIDEO, self)
    #     if previous_sequence == current_sequence:
    #         super().save(*args, **kwargs)
    #         return
    #     else:
    #         if current_sequence is not None:
    #             if current_sequence < previous_sequence:
    #                 items = SectionItemInfo.objects.filter(sequence__gte=current_sequence, sequence__lte=previous_sequence, section=self.section).order_by("-sequence").exclude(item_id=self.pk)
    #                 with transaction.atomic():
    #                     SectionItemInfo.objects.filter(item_id=self.pk).delete()
    #                     for item in items:
    #                         item.sequence += 1
    #                         item.save()
    #                 super().save(*args, **kwargs)
    #                 SectionItemInfo.create_item(self.section, self.sequence, SectionItemType.VIDEO, self)
    #             else:
    #                 items = SectionItemInfo.objects.filter(sequence__gte=previous_sequence, sequence__lte=current_sequence, section=self.section).order_by("sequence").exclude(item_id=self.pk)
    #                 with transaction.atomic():
    #                     SectionItemInfo.objects.filter(item_id=self.pk).delete()
    #                     for item in items:
    #                         item.sequence -= 1
    #                         item.save()
    #                 super().save(*args, **kwargs)
    #                 SectionItemInfo.create_item(self.section, self.sequence, SectionItemType.VIDEO, self)
    #
    # def delete(self, *args, **kwargs):
    #     max_sequence = SectionItemInfo.objects.filter(section=self.section).aggregate(Max('sequence'))['sequence__max']
    #     if self.sequence == max_sequence:
    #         with transaction.atomic():
    #             SectionItemInfo.objects.filter(item_id=self.pk).delete()
    #             super().delete(*args, **kwargs)
    #     else:
    #         items = SectionItemInfo.objects.filter(sequence__gt=self.sequence, section=self.section).order_by("sequence")
    #         with transaction.atomic():
    #             SectionItemInfo.objects.filter(item_id=self.pk).delete()
    #             for i in items:
    #                 i.sequence -= 1
    #                 i.save()
    #             super().delete(*args, **kwargs)

    def save(self, *args, **kwargs):
        SectionItemInfo.section_item_save_logic(self, super(), SectionItemType.VIDEO, args, kwargs)

    def delete(self, *args, **kwargs):
        SectionItemInfo.section_item_delete_logic(self, super(), args, kwargs)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["source", "start_time", "end_time"], name="unique_video_segment"
            )
        ]

# def section_item_save_logic(self, super, item_type: SectionItemType, args, kwargs):
#     previous = SectionItemInfo.objects.filter(item_id=self.pk).first()
#     previous_sequence = previous.sequence if previous else None
#     current_sequence = self.sequence
#
#     if previous is None:
#         if current_sequence is None:
#             max_sequence = SectionItemInfo.objects.aggregate(Max('sequence'))['sequence__max']
#             self.sequence = max_sequence + 1 if max_sequence else 1
#             super().save(*args, **kwargs)
#             SectionItemInfo.create_item(self.section, self.sequence, item_type, self)
#     if previous_sequence == current_sequence:
#         super().save(*args, **kwargs)
#         return
#     else:
#         if current_sequence is not None:
#             if current_sequence < previous_sequence:
#                 items = SectionItemInfo.objects.filter(sequence__gte=current_sequence, sequence__lte=previous_sequence,
#                                                        section=self.section).order_by("-sequence").exclude(
#                     item_id=self.pk)
#                 with transaction.atomic():
#                     SectionItemInfo.objects.filter(item_id=self.pk).delete()
#                     for item in items:
#                         item.sequence += 1
#                         item.save()
#                 super().save(*args, **kwargs)
#                 SectionItemInfo.create_item(self.section, self.sequence, item_type, self)
#             else:
#                 items = SectionItemInfo.objects.filter(sequence__gte=previous_sequence, sequence__lte=current_sequence,
#                                                        section=self.section).order_by("sequence").exclude(
#                     item_id=self.pk)
#                 with transaction.atomic():
#                     SectionItemInfo.objects.filter(item_id=self.pk).delete()
#                     for item in items:
#                         item.sequence -= 1
#                         item.save()
#                 super().save(*args, **kwargs)
#                 SectionItemInfo.create_item(self.section, self.sequence, SectionItemType.VIDEO, self)
#
# def section_item_delete_logic(self,super,args,kwargs):
#     max_sequence = SectionItemInfo.objects.filter(section=self.section).aggregate(Max('sequence'))['sequence__max']
#     if self.sequence == max_sequence:
#         with transaction.atomic():
#             SectionItemInfo.objects.filter(item_id=self.pk).delete()
#             super().delete(*args, **kwargs)
#     else:
#         items = SectionItemInfo.objects.filter(sequence__gt=self.sequence, section=self.section).order_by("sequence")
#         with transaction.atomic():
#             SectionItemInfo.objects.filter(item_id=self.pk).delete()
#             for i in items:
#                 i.sequence -= 1
#                 i.save()
#             super().delete(*args, **kwargs)
