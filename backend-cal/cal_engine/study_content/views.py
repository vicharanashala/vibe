from rest_framework import viewsets
from .models import Video, VideoMetadata, Article, ArticleAuthor, ArticleTopic
from .serializers import VideoSerializer, VideoMetadataSerializer, ArticleSerializer, ArticleAuthorSerializer, ArticleTopicSerializer

class VideoViewSet(viewsets.ModelViewSet):
    queryset = Video.objects.all()
    serializer_class = VideoSerializer

class VideoMetadataViewSet(viewsets.ModelViewSet):
    queryset = VideoMetadata.objects.all()
    serializer_class = VideoMetadataSerializer

class ArticleViewSet(viewsets.ModelViewSet):
    queryset = Article.objects.all()
    serializer_class = ArticleSerializer

class ArticleAuthorViewSet(viewsets.ModelViewSet):
    queryset = ArticleAuthor.objects.all()
    serializer_class = ArticleAuthorSerializer

class ArticleTopicViewSet(viewsets.ModelViewSet):
    queryset = ArticleTopic.objects.all()
    serializer_class = ArticleTopicSerializer

