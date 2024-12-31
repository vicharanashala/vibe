from rest_framework import generics, viewsets
from rest_framework.exceptions import NotFound, MethodNotAllowed
from ..models import Section, Video, Article
from ..serializers import SectionItemSerializer, VideoSerializer, ArticleSerializer


class SectionItemListView(generics.ListAPIView):
    serializer_class = SectionItemSerializer

    def get_queryset(self):
        course_id = self.request.query_params.get('course_id')
        module_id = self.request.query_params.get('module_id')
        section_id = self.request.query_params.get('section_id')

        if course_id is not None:
            return Section.objects.filter(module__course__id=course_id)

        if module_id is not None:
            return Section.objects.filter(module__id=module_id)

        if section_id is not None:
            return Section.objects.filter(id=section_id)

        raise NotFound("You must specify one of 'course_id', 'module_id', or 'section_id'.")


class VideoViewSet(viewsets.ModelViewSet):
    queryset = Video.objects.all()
    serializer_class = VideoSerializer

    def list(self, request, *args, **kwargs):
        raise MethodNotAllowed("GET", detail="Listing is not allowed for this resource.")


class ArticleViewSet(viewsets.ModelViewSet):
    queryset = Article.objects.all()
    serializer_class = ArticleSerializer

    def list(self, request, *args, **kwargs):
        raise MethodNotAllowed("GET", detail="Listing is not allowed for this resource.")
