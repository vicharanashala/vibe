from rest_framework.serializers import ModelSerializer, PrimaryKeyRelatedField
from django.core.exceptions import ValidationError
from ..models import CourseInstance, Course


class EnrolledCourseSerializer(ModelSerializer):
    class Meta:
        model = Course
        fields = ["id", "name", "description"]


class CourseInstanceReadSerializer(ModelSerializer):
    course = EnrolledCourseSerializer()

    class Meta:
        model = CourseInstance
        fields = ["id", "course", "start_date", "end_date"]

class CourseInstanceWriteSerializer(ModelSerializer):
    course_id = PrimaryKeyRelatedField(
        queryset=Course.objects.all(), write_only=True
    )

    class Meta:
        model = CourseInstance
        fields = ["course_id", "start_date", "end_date"]

    def create(self, validated_data):
        # Extract start_date and end_date from validated_data
        start_date = validated_data.pop("start_date", None)
        end_date = validated_data.pop("end_date", None)
        course_id = validated_data.pop("course_id", None)

        if not start_date or not end_date:
            raise ValidationError("start_date and end_date are required.")

        # Create the CourseInstance object
        course_instance_instance = CourseInstance.objects.create(
            course=course_id,
            start_date=start_date,
            end_date=end_date,
            **validated_data  # Any additional fields
        )
        return course_instance_instance




