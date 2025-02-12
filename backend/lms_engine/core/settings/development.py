from .base import *

DEBUG = True

SECRET_KEY = "django-insecure-bx)!$s-b%g@l96_e)zbsce*@db8rlw%7mvj+(za%@5loa_e&ln"

INSTALLED_APPS += [
    "drf_spectacular",
    "core.docs",
]

ALLOWED_HOSTS = ["*"]

CORS_ORIGIN_ALLOW_ALL = True

# Database
# https://docs.djangoproject.com/en/5.1/ref/settings/#databases

if config("LMSE_DB_ENGINE") == "sqlite3":
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": config("LMSE_DB_NAME"),
        }
    }
else:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.postgresql",
            "NAME": config("LMSE_DB_NAME"),
            "USER": config("LMSE_DB_USER"),
            "PASSWORD": config("LMSE_DB_PASSWORD"),
            "HOST": config("LMSE_DB_HOST"),
            "PORT": config("LMSE_DB_PORT"),
            "OPTIONS": {
                "sslmode": "require",
            },
        }
    }

REST_FRAMEWORK.update({"DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema"})

SPECTACULAR_SETTINGS = {
    "TITLE": "Core API",
    "DESCRIPTION": "API for Core",
    "VERSION": "1.0.0",
    "SERVE_INCLUDE_SCHEMA": True,
    "SERVE_URLCONF": "core.urls",
    "SCHEMA_PATH_PREFIX": "api/v1/docs/",
    "POSTPROCESSING_HOOKS": ["core.utils.schema.add_x_tag_groups"],
    "TAGS": [
        {
            "name": "Auth",
            "description": "Endpoints for authentication and user management",
        },
        {
            "name": "Assessment",
            "description": "Endpoints for assessments and related operations",
        },
        {"name": "Course", "description": "Endpoints for course management"},
        {"name": "Institution", "description": "Endpoints for institution management"},
        {"name": "User", "description": "Endpoints for user management"},
        {
            "name": "Module",
            "description": "Endpoints for modules and related operations",
        },
        {
            "name": "Section",
            "description": "Endpoints for sections and related operations",
        },
        {
            "name": "Question",
            "description": "Endpoints for questions and related operations",
        },
        {
            "name": "Course Instance",
            "description": "Endpoints for course instances and related operations",
        },
        {
            "name": "Video Assessment",
            "description": "Endpoints for video assessments and related operations",
        },
        {
            "name": "StandAlone Assessment",
            "description": "Endpoints for stand alone assessments and related operations",
        },
        {
            "name": "Solution",
            "description": "Endpoints for solutions and related operations",
        },
        {
            "name": "UserInstitution",
            "description": "Endpoints for user-institution relationships",
        },
        {
            "name": "UserCourseInstance",
            "description": "Endpoints for user-course enrollments",
        },
    ],
}
