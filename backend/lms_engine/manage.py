#!/usr/bin/env python
"""Django's command-line utility for administrative tasks."""
import os
import sys
import subprocess

# Run linting checks before executing the script
# Remove in Production
result = subprocess.run(
    ["flake8", "--exclude=myenv,**/__init__.py,venv,.venv,dist,build"],
    capture_output=True,
    text=True,
)

if result.returncode != 0:
    print("❌ Linting errors found:\n")
    print(result.stdout)
    sys.exit(1)


def main():
    """Run administrative tasks."""
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")
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
