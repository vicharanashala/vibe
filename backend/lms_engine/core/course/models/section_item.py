import uuid

from django.db import models, transaction
from django.db.models.aggregates import Max

from . import Section


class SectionItemType(models.TextChoices):
    ARTICLE = "article", "Article"
    ASSESSMENT = "assessment", "Assessment"
    VIDEO = "video", "Video"


class SectionItemInfo(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    section = models.ForeignKey(
        Section,
        on_delete=models.CASCADE,
        related_name="section_item_info",
        help_text="The section this item belongs to.",
    )
    sequence = models.PositiveIntegerField(
        help_text="The order of this item within the section."
    )
    item_type = models.CharField(
        choices=SectionItemType.choices,
        max_length=20,
        help_text="The type of this section item (video, article, etc.).",
    )
    item_id = models.UUIDField()

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["section", "sequence"],
                name="unique_section_sequence",
            )
        ]

    def __str__(self):
        return f"{self.section} - Item Sequence {self.sequence}"

    @property
    def prefixed_item_id(self):
        prefix_map = {
            SectionItemType.VIDEO: "v",
            SectionItemType.ASSESSMENT: "a",
            SectionItemType.ARTICLE: "ar",
        }
        prefix = prefix_map.get(self.item_type, "")
        return f"{self.item_id}"

    @staticmethod
    def create_item(section, sequence, item_type, item_instance):
        """
        Creates a record in SectionItemInfo in a transaction-safe way.
        """
        with transaction.atomic():
            print("Creating Section Item")
            print("Section: ", section)
            print("Sequence: ", sequence)
            print("Item Type: ", item_type)
            print("Item Instance: ", item_instance.id)
            return SectionItemInfo.objects.create(
                section=section,
                sequence=sequence,
                item_type=item_type,
                item_id=item_instance.id,
            )

    @staticmethod
    def section_item_save_logic(self, super, item_type: SectionItemType, args, kwargs):
        previous = SectionItemInfo.objects.filter(item_id=self.pk).first()
        previous_sequence = previous.sequence if previous else None
        current_sequence = self.sequence

        if previous is None:
            if current_sequence is None:
                print("Sequence is None")
                max_sequence = SectionItemInfo.objects.filter(
                    section=self.section
                ).aggregate(Max("sequence"))["sequence__max"]
                self.sequence = max_sequence + 1 if max_sequence else 1
                super.save(*args, **kwargs)

                print("Sequence assigned is ", self.sequence)
                SectionItemInfo.create_item(
                    self.section, self.sequence, item_type, self
                )
        if previous_sequence == current_sequence:
            super.save(*args, **kwargs)
            return
        else:
            if current_sequence is not None:
                print("Current Sequence :", current_sequence)
                print("Previous Sequence :", previous_sequence)

                if current_sequence and not previous_sequence:
                    items = (
                        SectionItemInfo.objects.filter(
                            sequence__gte=current_sequence, section=self.section
                        )
                        .order_by("-sequence")
                        .exclude(item_id=self.pk)
                    )
                    with transaction.atomic():
                        SectionItemInfo.objects.filter(item_id=self.pk).delete()
                        for item in items:
                            item.sequence += 1
                            item.save()
                    super.save(*args, **kwargs)
                    SectionItemInfo.create_item(
                        self.section, self.sequence, item_type, self
                    )
                    return

                if current_sequence < previous_sequence:
                    items = (
                        SectionItemInfo.objects.filter(
                            sequence__gte=current_sequence,
                            sequence__lte=previous_sequence,
                            section=self.section,
                        )
                        .order_by("-sequence")
                        .exclude(item_id=self.pk)
                    )
                    with transaction.atomic():
                        SectionItemInfo.objects.filter(item_id=self.pk).delete()
                        for item in items:
                            item.sequence += 1
                            item.save()
                    super.save(*args, **kwargs)
                    SectionItemInfo.create_item(
                        self.section, self.sequence, item_type, self
                    )
                else:
                    items = (
                        SectionItemInfo.objects.filter(
                            sequence__gte=previous_sequence,
                            sequence__lte=current_sequence,
                            section=self.section,
                        )
                        .order_by("sequence")
                        .exclude(item_id=self.pk)
                    )
                    with transaction.atomic():
                        SectionItemInfo.objects.filter(item_id=self.pk).delete()
                        for item in items:
                            item.sequence -= 1
                            item.save()
                    super.save(*args, **kwargs)
                    SectionItemInfo.create_item(
                        self.section, self.sequence, SectionItemType.VIDEO, self
                    )

    @staticmethod
    def section_item_delete_logic(self, super, args, kwargs):
        max_sequence = SectionItemInfo.objects.filter(section=self.section).aggregate(
            Max("sequence")
        )["sequence__max"]
        if self.sequence == max_sequence:
            with transaction.atomic():
                SectionItemInfo.objects.filter(item_id=self.pk).delete()
                super.delete(*args, **kwargs)
        else:
            items = SectionItemInfo.objects.filter(
                sequence__gt=self.sequence, section=self.section
            ).order_by("sequence")
            with transaction.atomic():
                SectionItemInfo.objects.filter(item_id=self.pk).delete()
                for i in items:
                    i.sequence -= 1
                    i.save()
                super.delete(*args, **kwargs)
