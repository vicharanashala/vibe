from .base import *
from decouple import config, Csv
import sentry_sdk

DEBUG = False

SECRET_KEY = config("LMSE_DJANGO_SECRET_KEY")


# TODO: Add hosts here
ALLOWED_HOSTS = config("LMSE_ALLOWED_HOSTS", cast=Csv())
CORS_ALLOWED_ORIGINS = config("LMSE_CORS_ALLOWED_ORIGINS", cast=Csv())
CSRF_COOKIE_SECURE = True
SESSION_COOKIE_SECURE = True
CSRF_TRUSTED_ORIGINS = config("LMSE_CSRF_TRUSTED_ORIGINS", cast=Csv())

SECURE_SSL_REDIRECT = config("LMSE_SECURE_SSL_REDIRECT", cast=bool)

STATIC_URL = config("LMSE_STATIC_URL")

sentry_sdk.init(
    dsn=config("LMSE_SENTRY_DSN"),
    traces_sample_rate=1.0,
    # TODO: Set this to a reasonable value
    profiles_sample_rate=0.3,
    send_default_pii=True,
)

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

STORAGES = {
    "staticfiles": {
        "BACKEND": "storages.backends.gcloud.GoogleCloudStorage",
        "OPTIONS": {
            "bucket_name": config("LMSE_GCP_BUCKET_NAME"),
            "gzip": True,
            "default_acl": "publicRead",
        },
    },
}


# TODO: Configure cache settings here

# TODO: Do some research before enabling this setting
# SECURE_HSTS_SECONDS = 31536000  # 1 year
# SECURE_HSTS_INCLUDE_SUBDOMAINS = True

# TODO: Make sure we need this setting
# DATABASES["default"]["CONN_MAX_AGE"] = 300
# DATABASES["default"]["CONN_HEALTH_CHECKS"] = True
