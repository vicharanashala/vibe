from django.db.models.signals import post_save
from django.dispatch import receiver
from .models import Video

@receiver(post_save, sender=Video)
def generate_video_id(sender, instance, created, **kwargs):
    if created:
        # youtube_id is already generated in save, no need to recreate
        print(f"Video '{instance.title}' created with YouTube ID: {instance.youtube_id}")


