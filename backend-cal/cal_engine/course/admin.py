from django.contrib import admin
from django.apps import apps
from django.contrib import admin
from .models import Course, Module, Section, SectionItem


class SectionAdmin(admin.ModelAdmin):
    list_display = ('title', 'module', 'sequence', 'created_at', 'updated_at')


class ModuleAdmin(admin.ModelAdmin):
    list_display = ('title', 'course', 'sequence', 'created_at', 'updated_at')


class CourseAdmin(admin.ModelAdmin):
    list_display = ('name', 'visibility', 'image', 'institution', 'created_at', 'updated_at')


admin.site.register(Course, CourseAdmin)
admin.site.register(Module, ModuleAdmin)
admin.site.register(Section, SectionAdmin)

