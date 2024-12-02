from django.core.management.base import BaseCommand
from cal_engine.institution.models import Institution
from cal_engine.course.models import Course
from cal_engine.assessment.models import Assessment
from cal_engine.user.models import User

class Command(BaseCommand):
    help = "Create a dummy Institution, Course, Assessment, and a Superuser"

    def handle(self, *args, **kwargs):
        # Create Institution
        institution, created = Institution.objects.get_or_create(
            name="Dummy Institution",
            defaults={
                "description": "This is a dummy institution for testing purposes.",
            },
        )
        if created:
            self.stdout.write(self.style.SUCCESS(f"Institution '{institution.name}' created."))
        else:
            self.stdout.write(self.style.WARNING(f"Institution '{institution.name}' already exists."))

        # Create Course
        course, created = Course.objects.get_or_create(
            name="Dummy Course",
            institution=institution,
            defaults={
                "description": "This is a dummy course for testing purposes.",
                "visibility": "public",
            },
        )
        if created:
            self.stdout.write(self.style.SUCCESS(f"Course '{course.name}' created under Institution '{institution.name}'."))
        else:
            self.stdout.write(self.style.WARNING(f"Course '{course.name}' already exists."))

        # Create Assessment
        assessment, created = Assessment.objects.get_or_create(
            title="Dummy Quiz",
            course=course,
            defaults={
                "type": "Quiz",
                "deadline": None,  # No deadline for dummy data
            },
        )
        if created:
            self.stdout.write(self.style.SUCCESS(f"Assessment '{assessment.title}' created under Course '{course.name}'."))
        else:
            self.stdout.write(self.style.WARNING(f"Assessment '{assessment.title}' already exists."))

        # Create Superuser
        try:
            superuser = User.objects.get(username="root")
            self.stdout.write(self.style.WARNING("Superuser 'root' already exists."))
        except User.DoesNotExist:
            superuser = User.objects.create_superuser(
                username="root",
                email="root@example.com",
                password="root",
                first_name="Root",
                last_name="User"
            )
            self.stdout.write(self.style.SUCCESS(f"Superuser '{superuser.username}' created."))

        self.stdout.write(self.style.SUCCESS("Dummy data setup completed."))

