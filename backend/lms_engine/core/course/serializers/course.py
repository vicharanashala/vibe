from rest_framework import serializers

from ...utils.helpers import truncate_text
from ..models import Course


class CourseListSerializer(serializers.ModelSerializer):
    description = serializers.SerializerMethodField()
    course_id = serializers.UUIDField(
        source="id",
        read_only=True,
        format="hex_verbose",
    )

    class Meta:
        model = Course
        fields = [
            "course_id",
            "name",
            "description",
            "visibility",
            "created_at",
        ]

    def get_description(self, obj):
        return truncate_text(obj.description)


class CourseDetailSerializer(serializers.ModelSerializer):
    module_count = serializers.SerializerMethodField()
    course_id = serializers.UUIDField(
        source="id",
        read_only=True,
        format="hex_verbose",
    )

    class Meta:
        model = Course
        fields = "__all__"

    def get_module_count(self, obj):
        return obj.modules.count()
