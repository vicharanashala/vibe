from rest_framework import serializers
from .models import Video, VideoMetadata, Article, ArticleAuthor, ArticleTopic

class VideoSerializer(serializers.ModelSerializer):
    class Meta:
        model = Video
        fields = '__all__'

class VideoMetadataSerializer(serializers.ModelSerializer):
    class Meta:
        model = VideoMetadata
        fields = '__all__'

class ArticleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Article
        fields = '__all__'

class ArticleAuthorSerializer(serializers.ModelSerializer):
    class Meta:
        model = ArticleAuthor
        fields = '__all__'

class ArticleTopicSerializer(serializers.ModelSerializer):
    class Meta:
        model = ArticleTopic
        fields = '__all__'
