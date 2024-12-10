from rest_framework.routers import DefaultRouter
from .views import VideoViewSet, ArticleViewSet

router = DefaultRouter()
router.register(r'videos', VideoViewSet)
router.register(r'articles', ArticleViewSet)


urlpatterns = router.urls
