from django.contrib import admin
from django.forms import ValidationError
from .models import Assessment, ChoiceSolution, DescSolution, NATSolution, Question

class NATSolutionInline(admin.StackedInline):
    model = NATSolution
    extra = 0  # No extra empty forms
    fields = ('value_type', 'value', 'tolerance_min', 'tolerance_max', 'decimal_precision')
    can_delete = False
    verbose_name = "NAT Solution"
    verbose_name_plural = "NAT Solutions"

class ChoiceSolutionInline(admin.TabularInline):
    model = ChoiceSolution
    extra = 0 # No extra empty forms
    fields = ('format', 'value', 'is_correct')
    verbose_name = "Choice Solution"
    verbose_name_plural = "Choice Solutions"

    def get_queryset(self, request):
        # Ensure only choice solutions related to MCQ or MSQ questions are displayed
        qs = super().get_queryset(request)
        return qs.filter(question__type__in=['MCQ', 'MSQ'])

class DescSolutionInline(admin.StackedInline):
    model = DescSolution
    extra = 0  # No extra empty forms
    fields = ('model_answer', 'min_word_limit', 'max_word_limit')
    can_delete = False
    verbose_name = "Descriptive Solution"
    verbose_name_plural = "Descriptive Solutions"

class QuestionAdmin(admin.ModelAdmin):
    list_display = ('text', 'type', 'marks', 'created_at', 'updated_at')
    search_fields = ('text', 'tags')
    list_filter = ('type', 'created_at')
    ordering = ('created_at',)
    readonly_fields = ('created_at', 'updated_at')

    def get_inlines(self, request, obj=None):
        """Dynamically determine inlines based on question type."""
        if obj and obj.type == 'NAT':
            return [NATSolutionInline]
        elif obj and obj.type in ['MCQ', 'MSQ']:
            return [ChoiceSolutionInline]
        elif obj and obj.type == 'DESC':
            return [DescSolutionInline]
        return []
            

class AssessmentAdmin(admin.ModelAdmin):
    list_display = ('title', 'course', 'deadline', 'created_at', 'updated_at')
    search_fields = ('title', 'course__name')
    list_filter = ('deadline', 'created_at')
    ordering = ('created_at',)

admin.site.register(Question, QuestionAdmin)
admin.site.register(Assessment, AssessmentAdmin)

