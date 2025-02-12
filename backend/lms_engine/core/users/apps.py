# users/apps.py

from django.apps import AppConfig


class UsersConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "core.users"

    def ready(self):
        from core.users.signals import user_signal
        from core.users.signals import user_course_instance_signal
