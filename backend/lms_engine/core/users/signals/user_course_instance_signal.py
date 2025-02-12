from django.db.models.signals import post_save
from django.dispatch import receiver
import requests
from core.course.models.course_instance import CourseInstance
from core.users.models import UserCourseInstance
import os
from core.course.models import Course  # Import Course model if necessary
import json





AE_HOST = os.getenv("ACTIVITY_ENGINE_URL", "/")  # Default to localhost if not set  # Default to 3001 if not set

AE_URL = f"{AE_HOST}/course-progress/initialize-progress"


@receiver(post_save, sender=UserCourseInstance)
def send_course_instance_data(sender, instance: UserCourseInstance, created, **kwargs):
    if created:  # Ensure we only send data when a new instance is created
        course_instance: CourseInstance = instance.course
        course: Course = course_instance.course
        print("Course: ", course)
        modules = course.modules.all()
        modules_payload = []

        for module in modules:
            sections_payload = []
            for section in module.sections.all():
                items_payload = [
                    {
                        "sectionItemId": item.prefixed_item_id,
                        "sequence": item.sequence,
                    }
                    for item in section.section_item_info.all()
                ]
                sections_payload.append({
                    "sectionId": str(section.id),
                    "sequence": section.sequence,
                    "sectionItems": items_payload,
                })

            modules_payload.append({
                "moduleId": str(module.id),
                "sequence": module.sequence,
                "sections": sections_payload,
            })

        payload = {
            "courseInstanceId": str(course.id),
            "studentIds": [str(instance.user.id)],
            "modules": modules_payload,
        }

        print("Sending course initialization...", json.dumps(payload, indent=1))

        # Send the POST request
        try:
            response = requests.post(AE_URL, json=payload)
            response.raise_for_status()
            print("Successfully sent!")
        except requests.exceptions.RequestException as e:
            print(f"Error sending course initialization: {e}")