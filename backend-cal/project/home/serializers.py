from rest_framework import serializers
from django.contrib.auth.models import User

from .models import (
    Institution, Profile, Course, CourseInstructorAssociation, Chapter, Video, Segment, Article, Question, Quiz, Performance, 
    StudySession, Violation, Log, Topic, TopicAssociation, StudentCourseAssociation, SegmentReplay, 
    ChapterCompletion, CourseCompletion, AssessmentAttempt, QuestionGroup, Group, Program, 
    ProgramGroupMapping, AssessmentGroup, AssessmentGroupMapping, StudyMaterial, StudyMaterialSection, 
    StudyMaterialSectionMapping, Feedback, Rating, CourseHistory, QuestionMediaMapping, QuestionGroupMediaMapping
)

class UserRegistrationSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=True, style={'input_type': 'password'})

    class Meta:
        model = User
        fields = ['username', 'email', 'password', 'first_name', 'last_name']

    def create(self, validated_data):
        user = User.objects.create_user(
            username=validated_data['username'],
            email=validated_data['email'],
            password=validated_data['password'],
            first_name=validated_data['first_name'],
            last_name=validated_data['last_name'],
        )
        return user

class InstitutionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Institution
        exclude = ['created_at']
        depth = 1

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = '__all__'
        depth = 1

class CourseSerializer(serializers.ModelSerializer):
    class Meta:
        model = Course
        fields = '__all__'
        depth = 1

class CourseInstructorAssociationSerializer(serializers.ModelSerializer):
    class Meta:
        model = CourseInstructorAssociation
        fields = '__all__'
        depth = 1

class ChapterSerializer(serializers.ModelSerializer):
    class Meta:
        model = Chapter
        fields = '__all__'
        depth = 1

class VideoSerializer(serializers.ModelSerializer):
    class Meta:
        model = Video
        fields = '__all__'
        depth = 1

class SegmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Segment
        fields = '__all__'
        depth = 1

class ArticleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Article
        fields = '__all__'
        depth = 1

class QuestionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Question
        fields = '__all__'
        depth = 1

class QuizSerializer(serializers.ModelSerializer):
    class Meta:
        model = Quiz
        fields = '__all__'
        depth = 1

class PerformanceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Performance
        fields = '__all__'
        depth = 1

class StudySessionSerializer(serializers.ModelSerializer):
    class Meta:
        model = StudySession
        fields = '__all__'
        depth = 1

class ViolationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Violation
        fields = '__all__'
        depth = 1

class LogSerializer(serializers.ModelSerializer):
    class Meta:
        model = Log
        fields = '__all__'
        depth = 1

class TopicSerializer(serializers.ModelSerializer):
    class Meta:
        model = Topic
        fields = '__all__'
        depth = 1

class TopicAssociationSerializer(serializers.ModelSerializer):
    class Meta:
        model = TopicAssociation
        fields = '__all__'
        depth = 1

class StudentCourseAssociationSerializer(serializers.ModelSerializer):
    class Meta:
        model = StudentCourseAssociation
        fields = '__all__'
        depth = 1

class SegmentReplaySerializer(serializers.ModelSerializer):
    class Meta:
        model = SegmentReplay
        fields = '__all__'
        depth = 1

class ChapterCompletionSerializer(serializers.ModelSerializer):
    class Meta:
        model = ChapterCompletion
        fields = '__all__'
        depth = 1

class CourseCompletionSerializer(serializers.ModelSerializer):
    class Meta:
        model = CourseCompletion
        fields = '__all__'
        depth = 1

class AssessmentAttemptSerializer(serializers.ModelSerializer):
    class Meta:
        model = AssessmentAttempt
        fields = '__all__'
        depth = 1

class QuestionGroupSerializer(serializers.ModelSerializer):
    class Meta:
        model = QuestionGroup
        fields = '__all__'
        depth = 1

class GroupSerializer(serializers.ModelSerializer):
    class Meta:
        model = Group
        fields = '__all__'
        depth = 1

class ProgramSerializer(serializers.ModelSerializer):
    class Meta:
        model = Program
        fields = '__all__'
        depth = 1

class ProgramGroupMappingSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProgramGroupMapping
        fields = '__all__'
        depth = 1

class AssessmentGroupSerializer(serializers.ModelSerializer):
    class Meta:
        model = AssessmentGroup
        fields = '__all__'
        depth = 1

class AssessmentGroupMappingSerializer(serializers.ModelSerializer):
    class Meta:
        model = AssessmentGroupMapping
        fields = '__all__'
        depth = 1

class StudyMaterialSerializer(serializers.ModelSerializer):
    class Meta:
        model = StudyMaterial
        fields = '__all__'
        depth = 1

class StudyMaterialSectionSerializer(serializers.ModelSerializer):
    class Meta:
        model = StudyMaterialSection
        fields = '__all__'
        depth = 1

class StudyMaterialSectionMappingSerializer(serializers.ModelSerializer):
    class Meta:
        model = StudyMaterialSectionMapping
        fields = '__all__'
        depth = 1

class FeedbackSerializer(serializers.ModelSerializer):
    class Meta:
        model = Feedback
        fields = '__all__'
        depth = 1

class RatingSerializer(serializers.ModelSerializer):
    class Meta:
        model = Rating
        fields = '__all__'
        depth = 1

class CourseHistorySerializer(serializers.ModelSerializer):
    class Meta:
        model = CourseHistory
        fields = '__all__'
        depth = 1

class QuestionMediaMappingSerializer(serializers.ModelSerializer):
    class Meta:
        model = QuestionMediaMapping
        fields = '__all__'
        depth = 1

class QuestionGroupMediaMappingSerializer(serializers.ModelSerializer):
    class Meta:
        model = QuestionGroupMediaMapping
        fields = '__all__'
        depth = 1

class profileSerializer(serializers.ModelSerializer):
    
    class Meta:
        model = Profile
        fields = '__all__'
        depth = 1

class loginTokenSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = '__all__'
        depth = 1