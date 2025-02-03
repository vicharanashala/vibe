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
        fields = "__all__"

class CourseInstanceWriteSerializer(ModelSerializer):
    course_id = PrimaryKeyRelatedField(
        queryset=Course.objects.all(), write_only=True
    )

    class Meta:
        model = CourseInstance
        fields = ["id","course_id", "start_date", "end_date"]

    def create(self, validated_data):
        # Extract data
        course_id = validated_data.pop("course_id")
        start_date = validated_data.pop("start_date")
        end_date = validated_data.pop("end_date")

        # Create the CourseInstance object
        course_instance = CourseInstance.objects.create(
            course=course_id,
            start_date=start_date,
            end_date=end_date,
            **validated_data
        )

        # Return the created instance
        return course_instance

    def validate(self, data):
        if data["end_date"] <= data["start_date"]:
            raise ValidationError("End date must be after start date.")
        return data


