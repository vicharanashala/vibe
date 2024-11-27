from rest_framework.routers import DefaultRouter
from .views import VideoViewSet, VideoMetadataViewSet, ArticleViewSet, ArticleAuthorViewSet, ArticleTopicViewSet

router = DefaultRouter()
router.register(r'videos', VideoViewSet)
router.register(r'video-metadata', VideoMetadataViewSet)
router.register(r'articles', ArticleViewSet)
router.register(r'article-authors', ArticleAuthorViewSet)
router.register(r'article-topics', ArticleTopicViewSet)

urlpatterns = router.urls
