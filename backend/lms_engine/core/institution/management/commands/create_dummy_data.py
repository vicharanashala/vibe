from django.core.management.base import BaseCommand
from core.institution.models import Institution
from core.course.models import Course, Module, Section
from core.study_content.models import Video, VideoSegment, Article
from core.assessment.models import Assessment
from core.user.models import User

class Command(BaseCommand):
    help = "Create a dummy Institution, Course, Modules, Sections, Videos, Articles, and a Superuser"

    def handle(self, *args, **kwargs):
        # Create Institution
        institution, created = Institution.objects.get_or_create(
            name="Dummy Institution",
            defaults={"description": "This is a dummy institution for testing purposes."},
        )
        if created:
            self.stdout.write(self.style.SUCCESS(f"Institution '{institution.name}' created."))
        else:
            self.stdout.write(self.style.WARNING(f"Institution '{institution.name}' already exists."))

        # Create Course
        course, created = Course.objects.get_or_create(
            name="Dummy Course",
            institution=institution,
            defaults={"description": "This is a dummy course for testing purposes.", "visibility": "public"},
        )
        if created:
            self.stdout.write(self.style.SUCCESS(f"Course '{course.name}' created under Institution '{institution.name}'."))
        else:
            self.stdout.write(self.style.WARNING(f"Course '{course.name}' already exists."))

        # Create Module
        module, created = Module.objects.get_or_create(
            course=course,
            title="Dummy Module 1",
            defaults={"description": "This is a dummy module for testing.", "sequence": 1},
        )
        if created:
            self.stdout.write(self.style.SUCCESS(f"Module '{module.title}' created under Course '{course.name}'."))
        else:
            self.stdout.write(self.style.WARNING(f"Module '{module.title}' already exists."))

        # Create Section
        section, created = Section.objects.get_or_create(
            module=module,
            title="Dummy Section 1",
            defaults={"description": "This is a dummy section for testing.", "sequence": 1},
        )
        if created:
            self.stdout.write(self.style.SUCCESS(f"Section '{section.title}' created under Module '{module.title}'."))
        else:
            self.stdout.write(self.style.WARNING(f"Section '{section.title}' already exists."))

        # Create Video
        video, created = Video.objects.get_or_create(
            section=section,
            title="Dummy Video",
            defaults={
                "description": "This is a dummy video.",
                "link": "http://example.com/video",
                "youtube_id": "dummy_id",
                "sequence": 1,
            },
        )
        if created:
            self.stdout.write(self.style.SUCCESS(f"Video '{video.title}' created in Section '{section.title}'."))
        else:
            self.stdout.write(self.style.WARNING(f"Video '{video.title}' already exists."))

        # Create VideoSegment
        video_segment, created = VideoSegment.objects.get_or_create(
            video=video,
            title="Segment 1",
            defaults={
                "start_time": 0,
                "transcript": "This is a dummy transcript.",
                "assessment": None,  # No assessment for this dummy data
            },
        )
        if created:
            self.stdout.write(self.style.SUCCESS(f"Video Segment '{video_segment.title}' created for Video '{video.title}'."))
        else:
            self.stdout.write(self.style.WARNING(f"Video Segment '{video_segment.title}' already exists."))

        # Create Article
        article, created = Article.objects.get_or_create(
            section=section,
            title="Dummy Article",
            defaults={
                "subtitle": "A dummy article for testing.",
                "description": "This is a dummy article.",
                "content": "Dummy content for the article.",
                "sequence": 2,
            },
        )
        if created:
            self.stdout.write(self.style.SUCCESS(f"Article '{article.title}' created in Section '{section.title}'."))
        else:
            self.stdout.write(self.style.WARNING(f"Article '{article.title}' already exists."))

        # Create Assessment
        assessment, created = Assessment.objects.get_or_create(
            title="Dummy Quiz",
            course=course,
            defaults={"type": "normal", "deadline": None},
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
