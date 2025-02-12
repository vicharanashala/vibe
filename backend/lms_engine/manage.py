#!/usr/bin/env python
"""Django's command-line utility for administrative tasks."""
import os
import sys
from decouple import config

def main():
    """Run administrative tasks."""

    django_env = config("LMSE_DJANGO_ENVIRONMENT")

    if django_env:
        os.environ["DJANGO_SETTINGS_MODULE"] = f"core.settings.{django_env}"
        print(config("LMSE_DJANGO_ENVIRONMENT"))
    else:
        print("DEVELOPMENT SERVER")
        os.environ["DJANGO_SETTINGS_MODULE"] = "core.settings.development"

    try:
        from django.core.management import execute_from_command_line
    except ImportError as exc:
        raise ImportError(
            "Couldn't import Django. Are you sure it's installed and "
            "available on your PYTHONPATH environment variable? Did you "
            "forget to activate a virtual environment?"
        ) from exc
    execute_from_command_line(sys.argv)


if __name__ == "__main__":
    main()
