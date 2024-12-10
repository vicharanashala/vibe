from django.contrib import admin
from django.apps import apps
from django.contrib import admin
from .models import Course, Module, Section, SectionItem


class SectionAdmin(admin.ModelAdmin):
    list_display = ('title', 'module', 'sequence', 'created_at', 'updated_at')


class ModuleAdmin(admin.ModelAdmin):
    list_display = ('title', 'course', 'sequence', 'created_at', 'updated_at')


class CourseAdmin(admin.ModelAdmin):
    list_display = ('name', 'visibility', 'get_institutions', 'get_instructors', 'created_at', 'updated_at')

    def get_institutions(self, obj):
        return ", ".join([institution.name for institution in obj.institutions.all()])
    get_institutions.short_description = 'Institutions'

    def get_instructors(self, obj):
        return ", ".join([instructor.name for instructor in obj.instructors.all()])
    get_instructors.short_description = 'Instructors'


admin.site.register(Course, CourseAdmin)
admin.site.register(Module, ModuleAdmin)
admin.site.register(Section, SectionAdmin)

