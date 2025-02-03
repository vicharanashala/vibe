from rest_framework import serializers

from ..models import Module
from ...utils.helpers import truncate_text

class ModuleListSerializer(serializers.ModelSerializer):
    """
    Summary serializer for the Module model.
    """
    description = serializers.SerializerMethodField()
    module_id = serializers.IntegerField(source='id', read_only=True)

    class Meta:
        model = Module
        fields = ['module_id', 'title', 'description', 'sequence', 'created_at']

    def get_description(self, obj):
        return truncate_text(obj.description)


class ModuleDetailSerializer(serializers.ModelSerializer):
    """
    Detailed serializer for the Module model.
    """
    section_count = serializers.SerializerMethodField()



    class Meta:
        model = Module
        fields = '__all__'

    def get_section_count(self, obj):
        return obj.sections.count()
