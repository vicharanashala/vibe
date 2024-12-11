from rest_framework import serializers
from .models import Course, Module, Section, SectionItem
from core.institution.models import Institution


class SectionItemSerializer(serializers.ModelSerializer):
    """
    Serializer for the SectionItem model.
    """
    class Meta:
        model = SectionItem
        exclude = ('created_at', 'updated_at')


class SectionSerializer(serializers.ModelSerializer):
    """
    Serializer for the Section model.
    """
    class Meta:
        model = Section
        exclude = ('created_at', 'updated_at')


class ModuleSectionSummarySerializer(serializers.ModelSerializer):
    """
    Serializer for the Section model to be used in ModuleSerializer.
    """
    class Meta:
        model = Section
        fields = ('id', 'title', 'description', 'sequence')


class ModuleSerializer(serializers.ModelSerializer):
    """
    Serializer for the Module model.
    """

    sections = ModuleSectionSummarySerializer(many=True, read_only=True)

    class Meta:
        model = Module
        fields = ('id','course', 'title', 'description', 'sequence', 'sections')


class CourseModuleSummarySerializer(serializers.ModelSerializer):
    """
    Serializer for the Module model to be used in CourseSerializer.
    """
    class Meta:
        model = Module
        fields = ('id', 'title','description', 'sequence')


class CourseInstitutionSummarySerializer(serializers.ModelSerializer):
    """
    Serializer for the Institution model to be used in CourseSerializer.
    """
    class Meta:
        model = Institution
        fields = ('id', 'name', 'description')


class CourseSerializer(serializers.ModelSerializer):
    """
    Serializer for the Course model.
    """
    modules = CourseModuleSummarySerializer(many=True, read_only=True)
    institution_details = CourseInstitutionSummarySerializer(source='institution', read_only=True)
    enrolled = serializers.SerializerMethodField()

    class Meta:
        model = Course
        fields = ('id', 'name', 'visibility', 'institution_details', 'description', 'modules', 'image', 'enrolled')

    def get_enrolled(self, obj):
        return getattr(obj, 'enrolled', False)

    def to_representation(self, instance):
        representation = super().to_representation(instance)
        if not representation.get('enrolled', False):
            representation.pop('modules', None)
        return representation

