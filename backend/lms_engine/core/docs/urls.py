from django.urls import path
from drf_spectacular.views import SpectacularAPIView

from .views import api_docs

urlpatterns = [
    # OpenAPI schema endpoint
    path("schema/", SpectacularAPIView.as_view(), name="api_schema"),
    # API Docs endpoint
    path("", api_docs, name="api_docs"),
]
