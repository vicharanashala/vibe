from rest_framework import viewsets
from .models import Video, Article
from .serializers import VideoSerializer, ArticleSerializer

class VideoViewSet(viewsets.ModelViewSet):
    queryset = Video.objects.all()
    serializer_class = VideoSerializer

    # def create(self, request, *args, **kwargs):
    #     """
    #     Create a new video.
        
    #     Args:
    #         request (Request): The HTTP request object containing data for the new video.
    #         *args (tuple): Additional positional arguments passed to the method.
    #         **kwargs (dict): Additional keyword arguments passed to the method.
        
    #     Returns:
    #         Response: A DRF Response object containing the created video's data.
    #     """
    #     serializer = self.get_serializer(data=request.data)
    #     serializer.is_valid(raise_exception=True)
    #     self.perform_create(serializer)
    #     headers = self.get_success_headers(serializer.data)
    #     return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)

class ArticleViewSet(viewsets.ModelViewSet):
    queryset = Article.objects.all()
    serializer_class = ArticleSerializer
