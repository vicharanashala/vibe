from dataclasses import dataclass, asdict
from rest_framework import serializers

from ..models import Section
from ...utils.helpers import truncate_text


# @dataclass
# class ItemCounts:
#     videos: int
#     articles: int
#     assessments: int


class SectionListSerializer(serializers.ModelSerializer):
    """
    Summary serializer for the Section model.
    """
    description = serializers.SerializerMethodField()

    class Meta:
        model = Section
        fields = ['id', 'title', 'description', 'sequence', 'created_at']

    def get_description(self, obj):
        return truncate_text(obj.description)

class SectionDetailSerializer(serializers.ModelSerializer):
    """
    Detailed serializer for the Section model.
    """
    # item_counts = serializers.SerializerMethodField()

    class Meta:
        model = Section
        fields = '__all__'

    # def get_item_counts(self, obj):
    #     return asdict(ItemCounts(
    #         videos=obj.videos.count(),
    #         articles=obj.articles.count(),
    #         assessments=obj.assessments.count()
    #         items=
    #     ))
