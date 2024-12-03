from django.contrib import admin
from django.apps import apps
from .models import Video, VideoSegment


class VideoSegmentInline(admin.TabularInline):
    model = VideoSegment
    fields = ('title', 'sequence', 'start_time', 'end_time', 'assessment')
    extra = 0


class VideoAdmin(admin.ModelAdmin):
    list_display = ('title', 'module', 'created_at', 'updated_at')
    inlines = [VideoSegmentInline]

# class ArticleAdmin(admin.ModelAdmin):
#     list_display = ('title', 'content_type', 'module', 'created_at', 'updated_at')


admin.site.register(Video, VideoAdmin)
# admin.site.register(Article, ArticleAdmin)

