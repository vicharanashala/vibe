from rest_framework import generics, viewsets, serializers
from drf_spectacular.utils import extend_schema, extend_schema_view, OpenApiParameter, OpenApiExample

from ..models import Section, Video, Article, SectionItemInfo, SectionItemType

from rest_framework.response import Response
from rest_framework.exceptions import NotFound, MethodNotAllowed
from ..models import SectionItemInfo
from ..serializers import VideoSerializer, ArticleSerializer

from drf_spectacular.utils import extend_schema, OpenApiParameter, extend_schema_view

from ...assessment.models import Assessment
from ...assessment.serializers import AssessmentSerializer


@extend_schema_view(

    get=extend_schema(
        tags=['Item'],
        summary="List all section items",
        description="Retrieve all section items for a given section ID in ascending order of their sequence.",
        parameters=[
            OpenApiParameter(
                name="section_id",
                description="ID of the section whose items are to be fetched.",
                required=True,
                type=int,
            )
        ],
        responses={200: "List of Section Items"},
    )
)
class SectionItemViewSet(generics.ListAPIView):
    """
    API endpoint to list section items based on section ID in ascending order of sequence.
    """
    serializer_class = None  # Will dynamically set based on item type.

    def get(self, request, *args, **kwargs):
        section_id = request.query_params.get("section_id")
        if not section_id:
            return Response(
                {"detail": "section_id query parameter is required."}, status=400
            )

        # Fetch the section items
        section_items = SectionItemInfo.objects.filter(section_id=section_id).order_by(
            "sequence"
        )

        if not section_items.exists():
            raise NotFound(f"No items found for section_id={section_id}.")

        # Prepare the response data
        data = []

        for item in section_items:
            if item.item_type == SectionItemType.VIDEO:
                video = Video.objects.get(id=item.item_id)
                serializer_data = VideoSerializer(video).data
                serializer_data["item_type"] = SectionItemType.VIDEO
            elif item.item_type == SectionItemType.ARTICLE:
                print(item)
                article = Article.objects.get(id=item.item_id)
                serializer_data = ArticleSerializer(article).data
                serializer_data["item_type"] = SectionItemType.ARTICLE
            elif item.item_type == SectionItemType.ASSESSMENT:
                assessment = Assessment.objects.get(id=item.item_id)
                serializer_data = AssessmentSerializer(assessment).data
                serializer_data["item_type"] = SectionItemType.ASSESSMENT
            else:
                serializer_data = {"detail": f"Unsupported item_type: {item.item_type}"}

            data.append(serializer_data)

        return Response(data, status=200)


@extend_schema_view(
    retrieve=extend_schema(
        summary="Retrieve Video",
        tags=["Video"],
        description="Retrieve a specific video by ID.",
        responses={200: VideoSerializer},
    ),
    create=extend_schema(
        summary="Create Video",
        tags=["Video"],
        description="Create a new video item along with its section item information.",
        request=VideoSerializer,
        responses={201: VideoSerializer},
    ),
    update=extend_schema(
        summary="Update Video",
        tags=["Video"],
        description="Update an existing video item.",
        request=VideoSerializer,
        responses={200: VideoSerializer},
    ),
    partial_update=extend_schema(
        summary="Partially Update Video",
        tags=["Video"],
        description="Partially update an existing video item.",
        request=VideoSerializer,
        responses={200: VideoSerializer},
    ),
    destroy=extend_schema(
        summary="Delete Video",
        tags=["Video"],
        description="Delete a specific video item.",
        responses={204: None},
    ),
)
class VideoViewSet(viewsets.ModelViewSet):
    queryset = Video.objects.all()
    serializer_class = VideoSerializer
    #
    # def list(self, request, *args, **kwargs):
    #     return MethodNotAllowed(detail="This method is not allowed")
    #

@extend_schema_view(
    retrieve=extend_schema(
        summary="Retrieve Article",
        tags=["Article"],
        description="Retrieve a specific article by ID.",
        responses={200: ArticleSerializer},
    ),
    create=extend_schema(
        summary="Create Article",
        tags=["Article"],
        description="Create a new article item along with its section item information.",
        request=ArticleSerializer,
        responses={201: ArticleSerializer},
    ),
    update=extend_schema(
        summary="Update Article",
        tags=["Article"],
        description="Update an existing article item.",
        request=ArticleSerializer,
        responses={200: ArticleSerializer},
    ),
    partial_update=extend_schema(
        summary="Partially Update Article",
        tags=["Article"],
        description="Partially update an existing article item.",
        request=ArticleSerializer,
        responses={200: ArticleSerializer},
    ),
    destroy=extend_schema(
        summary="Delete Article",
        tags=["Article"],
        description="Delete a specific article item.",
        responses={204: None},
    ),
)
class ArticleViewSet(viewsets.ModelViewSet):
    queryset = Article.objects.all()
    serializer_class = ArticleSerializer

    # def list(self, request, *args, **kwargs):
    #     return MethodNotAllowed(detail="This method is not allowed")
