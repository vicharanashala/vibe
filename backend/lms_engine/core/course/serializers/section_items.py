from rest_framework import serializers

from ...assessment.serializers import AssessmentSerializer
from ..models import Video, Article


class VideoSerializer(serializers.ModelSerializer):
    """
    Serializer for the Video model.
    """
    class Meta:
        model = Video
        fields = '__all__'


class ArticleSerializer(serializers.ModelSerializer):
    """
    Serializer for the Article model.
    """
    class Meta:
        model = Article
        fields = '__all__'


class SectionItemSerializer(serializers.Serializer):
    """
    Serializer for the Section model with nested items.
    """
    videos = VideoSerializer(many=True)
    articles = ArticleSerializer(many=True)
    assessments = AssessmentSerializer(many=True)
