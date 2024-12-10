from django.contrib import admin
from .models import Video, VideoSegment, Article
from .forms import VideoForm

# Register the models to make them accessible via Django admin
@admin.register(Video)
class VideoAdmin(admin.ModelAdmin):
    form = VideoForm  # Use the custom form for video upload
    list_display = ('title', 'youtube_id', 'link', 'section', 'sequence')
    search_fields = ('title', 'youtube_id')

@admin.register(VideoSegment)
class VideoSegmentAdmin(admin.ModelAdmin):
    list_display = ('video', 'title', 'start_time', 'created_at')
    search_fields = ('title',)

@admin.register(Article)
class ArticleAdmin(admin.ModelAdmin):
    list_display = ('title', 'content_type', 'created_at')
    search_fields = ('title',)
