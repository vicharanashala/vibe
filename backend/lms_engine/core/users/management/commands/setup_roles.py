# In core/users/management/commands/setup_roles.py
from django.core.management.base import BaseCommand
from core.users.models import Group
from core.users.utils import ROLES


class Command(BaseCommand):
    help = "Create predefined roles as groups"

    def handle(self, *args, **kwargs):
        for role in ROLES:
            group, created = Group.objects.get_or_create(name=role)
            if created:
                self.stdout.write(self.style.SUCCESS(f"Role '{role}' created."))
            else:
                self.stdout.write(self.style.WARNING(f"Role '{role}' already exists."))
