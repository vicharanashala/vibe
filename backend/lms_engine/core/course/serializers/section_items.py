from django.db import transaction
from rest_framework import serializers

from ...assessment.models import Assessment
from ..models import Article, Section, SectionItemInfo, SectionItemType, Source, Video


class VideoSerializer(serializers.ModelSerializer):
    source = serializers.URLField()

    class Meta:
        model = Video
        exclude = ["created_at", "updated_at"]

    def create(self, validated_data):   
        source_data = validated_data.pop("source")
        source_obj, created = Source.objects.get_or_create(url=source_data)
        video = Video.objects.create(source=source_obj, **validated_data)
        return video


class ArticleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Article
        exclude = ["created_at", "updated_at"]
