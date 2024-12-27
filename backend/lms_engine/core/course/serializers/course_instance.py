from rest_framework.serializers import ModelSerializer

from ..models import CourseInstance, Course


class EnrolledCourseSerializer(ModelSerializer):
    class Meta:
        model = Course
        fields = ["id", "name", "description"]


class CourseInstanceSerializer(ModelSerializer):
    course = EnrolledCourseSerializer()

    class Meta:
        model = CourseInstance
        fields = ["id", "course"]
