from django.contrib import admin

from .models import Assessment, DescriptiveSolution, NATSolution, Question, MCQSolution, MSQSolution, QuestionOption

class NATSolutionInline(admin.StackedInline):
    model = NATSolution
    extra = 0  # No extra empty forms
    fields = ('value_type', 'value', 'tolerance_min', 'tolerance_max', 'decimal_precision')
    can_delete = False
    verbose_name = "NAT Solution"
    verbose_name_plural = "NAT Solutions"

class DescriptiveSolutionInline(admin.StackedInline):
    model = DescriptiveSolution
    extra = 0  # No extra empty forms
    fields = ('model_answer', 'min_word_limit', 'max_word_limit')
    can_delete = False
    verbose_name = "Descriptive Solution"
    verbose_name_plural = "Descriptive Solutions"

class MCQSolutionInline(admin.StackedInline):
    model = MCQSolution
    extra = 0  # No extra empty forms
    fields = ('choice',)
    can_delete = False
    verbose_name = "MCQ Solution"
    verbose_name_plural = "MCQ Solutions"

class MSQSolutionInline(admin.StackedInline):
    model = MSQSolution
    extra = 0  # No extra empty forms
    fields = ('choice',)
    can_delete = False
    verbose_name = "MSQ Solution"
    verbose_name_plural = "MSQ Solutions"

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
        elif obj and obj.type == 'MCQ':
            return [MCQSolutionInline]
        elif obj and obj.type == 'MSQ':
            return [MSQSolutionInline]
        elif obj and obj.type == 'DESC':
            return [DescriptiveSolutionInline]
        return []
            

class AssessmentAdmin(admin.ModelAdmin):
    list_display = ('title', "section", "sequence" ,'created_at', 'updated_at')
    search_fields = ('title',)
    list_filter = ('created_at',)
    ordering = ('created_at',)

admin.site.register(Question, QuestionAdmin)
admin.site.register(Assessment, AssessmentAdmin)
admin.site.register(QuestionOption)