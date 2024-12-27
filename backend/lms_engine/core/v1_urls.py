from django.urls import include, path


urlpatterns = [
    path("user/", include("core.user.urls")),
    path("institution/", include("core.institution.urls")),
    path("course/", include("core.course.urls")),
    path("assessment/", include("core.assessment.urls")),
    path("auth/", include("core.auth.urls")),
    # API Documentation
    path("docs/", include("core.docs.urls")),
]
