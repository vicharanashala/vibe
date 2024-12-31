from django.urls import path
from .views import api_docs
from drf_spectacular.views import SpectacularAPIView

urlpatterns = [
    # OpenAPI schema endpoint
    path("schema/", SpectacularAPIView.as_view(), name="api_schema"),
    # API Docs endpoint
    path("", api_docs, name="api_docs"),
]
