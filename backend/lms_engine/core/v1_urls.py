# v1_urls.py

from django.urls import include, path

from .settings import base as settings

urlpatterns = [
    path("institution/", include("core.institution.urls")),
    path("course/", include("core.course.urls")),
    path("assessment/", include("core.assessment.urls")),
    path("auth/", include("core.authentication.urls")),
    path("users/", include("core.users.urls")),
]

# API Documentation
if settings.ENV == "development":
    urlpatterns.append(path("docs/", include("core.docs.urls")))
