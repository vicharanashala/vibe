from django.contrib import admin
from .models import Assessment, Question

class AssessmentAdmin(admin.ModelAdmin):
    list_display = ('title', 'course', 'deadline', 'created_at', 'updated_at')
    search_fields = ('title', 'course__name')
    list_filter = ('deadline', 'created_at')
    ordering = ('created_at',)

class QuestionAdmin(admin.ModelAdmin):
    list_display = ('text', 'type', 'marks', 'partial_marking', 'created_at', 'updated_at')
    search_fields = ('text', 'tags')
    list_filter = ('type', 'partial_marking', 'created_at')
    ordering = ('created_at',)
    readonly_fields = ('created_at', 'updated_at')

admin.site.register(Assessment, AssessmentAdmin)
admin.site.register(Question, QuestionAdmin)

