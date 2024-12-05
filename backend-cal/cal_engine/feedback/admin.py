from django.contrib import admin
from django.apps import apps

app = apps.get_app_config(__name__.split('.')[-2])  # Get current app's config
for model in app.get_models():
    admin.site.register(model)

