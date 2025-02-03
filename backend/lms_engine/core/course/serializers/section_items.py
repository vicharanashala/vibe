from django.db import transaction
from rest_framework import serializers
from ..models import Article, Source, SectionItemInfo, Section, SectionItemType, Video
from ...assessment.models import Assessment


from django.db import transaction

class VideoSerializer(serializers.ModelSerializer):
    source = serializers.URLField()

    class Meta:
        model = Video
        exclude = ['created_at', 'updated_at']




class ArticleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Article
        exclude = ['created_at', "updated_at"]


