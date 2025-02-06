from django.db import transaction
from rest_framework import serializers

from ...assessment.models import Assessment
from ..models import Article, Section, SectionItemInfo, SectionItemType, Source, Video


class VideoSerializer(serializers.ModelSerializer):
    source = serializers.URLField()

    class Meta:
        model = Video
        exclude = ["created_at", "updated_at"]


class ArticleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Article
        exclude = ["created_at", "updated_at"]
