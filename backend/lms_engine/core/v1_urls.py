#v1_urls.py

from django.urls import include, path


urlpatterns = [
    path("institution/", include("core.institution.urls")),
    path("course/", include("core.course.urls")),
    path("assessment/", include("core.assessment.urls")),
    path("auth/", include("core.authentication.urls")),
    path("users/", include("core.users.urls")),
    # API Documentation
    path("docs/", include("core.docs.urls")),
]
