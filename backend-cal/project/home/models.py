from django.db import models
import uuid
from datetime import datetime, timedelta

class Institution(models.Model):
    name = models.CharField(max_length=255, unique=True)
    description = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    url = models.URLField(null=True, blank=True)
    status = models.IntegerField(null=True, blank=True, default=0)

    def __str__(self):
        return self.name

class Profile(models.Model):
    username = models.CharField(max_length=255, unique=True)
    email = models.EmailField(unique=True)
    login = models.BooleanField(default=False)
    user_type = models.CharField(max_length=255)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    institution = models.ForeignKey(Institution, on_delete=models.CASCADE, null=True, blank=True)
    last_ip = models.CharField(max_length=50, blank=True, null=True)

    def __str__(self):
        return self.username
    
class adminInstitutionAssociation(models.Model):
    admin_id = models.ForeignKey(Profile, related_name='admin_associations', on_delete=models.CASCADE)
    institution_id = models.ForeignKey(Institution, related_name='admin_associations', on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.admin.username} - {self.institution.name}"

class Course(models.Model):
    name = models.CharField(max_length=255, unique=True)
    description = models.TextField(null=True, blank=True)
    is_public = models.BooleanField(default=False)
    group = models.ForeignKey('Group', null=True, blank=True, on_delete=models.SET_NULL)
    program = models.ForeignKey('Program', null=True, blank=True, on_delete=models.SET_NULL)

    def __str__(self):
        return self.name

class CourseInstructorAssociation(models.Model):
    instructor = models.ForeignKey(Profile, on_delete=models.CASCADE)
    course = models.ForeignKey(Course, on_delete=models.CASCADE)
    role = models.CharField(max_length=255) #professor, teaching assisstant etc

    def __str__(self):
        return f"{self.course.name} - {self.instructor.name}"

class Chapter(models.Model):
    title = models.CharField(max_length=255)
    description = models.TextField(null=True, blank=True)
    course = models.ForeignKey(Course, on_delete=models.CASCADE)
    created_by = models.ForeignKey(Profile, null=True, blank=True, on_delete=models.SET_NULL)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.title

class Video(models.Model):
    chapter = models.ForeignKey(Chapter, on_delete=models.CASCADE)
    prof = models.ForeignKey(Profile, on_delete=models.CASCADE)
    title = models.CharField(max_length=255)
    description = models.TextField(null=True, blank=True)
    transcript = models.TextField(null=True, blank=True)
    duration = models.IntegerField()
    link = models.URLField()
    created_at = models.DateTimeField(auto_now_add=True)
    deadline = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return self.title

class Segment(models.Model):
    video = models.ForeignKey(Video, on_delete=models.CASCADE)
    start_time = models.IntegerField()
    end_time = models.IntegerField()

    def __str__(self):
        return f"{self.video.title} ({self.start_time}-{self.end_time})"

class Article(models.Model):
    course = models.ForeignKey(Course, on_delete=models.CASCADE)
    prof = models.ForeignKey(Profile, on_delete=models.CASCADE)
    title = models.CharField(max_length=255, unique=True)
    subtitle = models.CharField(max_length=255, null=True, blank=True)
    description = models.TextField()
    topics = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    deadline = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return self.title

class Question(models.Model):
    question = models.TextField()
    options = models.JSONField()
    hint = models.CharField(max_length=255, null=True, blank=True)
    score = models.IntegerField()
    correct_ans = models.JSONField()
    label = models.CharField(max_length=255)
    type = models.CharField(max_length=255)
    timelimit = models.IntegerField(null=True, blank=True)
    course = models.ForeignKey(Course, on_delete=models.CASCADE)
    chapter = models.ForeignKey(Chapter, on_delete=models.CASCADE)
    segment = models.ForeignKey(Segment, on_delete=models.CASCADE, null=True, blank=True)
    article = models.ForeignKey(Article, on_delete=models.CASCADE, null=True, blank=True)
    quiz = models.ForeignKey('Quiz', on_delete=models.CASCADE, null=True, blank=True)

    def __str__(self):
        return self.question

class Quiz(models.Model):
    title = models.CharField(max_length=255)
    course = models.ForeignKey(Course, on_delete=models.CASCADE)
    chapter = models.ForeignKey(Chapter, on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)
    grading_status = models.CharField(max_length=50, default="pending")
    deadline = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return self.title

class Performance(models.Model):
    student = models.ForeignKey(Profile, on_delete=models.CASCADE)
    question = models.ForeignKey(Question, on_delete=models.CASCADE)
    quiz = models.ForeignKey(Quiz, on_delete=models.CASCADE)
    correct = models.BooleanField()
    attempt_time = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.student.username} - {self.question.question}"

class StudySession(models.Model):
    user = models.ForeignKey(Profile, on_delete=models.CASCADE)
    course = models.ForeignKey(Course, on_delete=models.CASCADE)
    duration = models.IntegerField()
    violations = models.IntegerField()
    start_time = models.DateTimeField()
    grading_status = models.CharField(max_length=50, default="pending")
    end_time = models.DateTimeField()

    def __str__(self):
        return f"{self.user.username} - {self.course.name}"

class Violation(models.Model):
    session = models.ForeignKey(StudySession, on_delete=models.CASCADE)
    timestamp = models.DateTimeField()
    type = models.CharField(max_length=255)

    def __str__(self):
        return f"{self.session.user.username} - {self.type}"
    


class PasswordResetToken(models.Model):
    user = models.ForeignKey(Profile, on_delete=models.CASCADE, related_name="password_reset_tokens")
    token = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()

    def save(self, *args, **kwargs):
        if not self.expires_at:
            self.expires_at = datetime.now() + timedelta(hours=24)  # Token expires in 24 hours
        super().save(*args, **kwargs)

    def is_expired(self):
        return datetime.now() > self.expires_at

    def __str__(self):
        return f"Password Reset Token for {self.user.email} (Expires: {self.expires_at})"
    

class Log(models.Model):
    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey(Profile, on_delete=models.CASCADE)
    description = models.TextField()

    def __str__(self):
        return f"{self.created_by.username} - {self.created_at}"

class Topic(models.Model):
    name = models.CharField(max_length=255, unique=True)

    def __str__(self):
        return self.name

class TopicAssociation(models.Model):
    topic = models.ForeignKey(Topic, on_delete=models.CASCADE)
    course = models.ForeignKey(Course, on_delete=models.CASCADE)

    def __str__(self):
        return f"{self.topic.name} - {self.course.name}"

class StudentCourseAssociation(models.Model):
    student = models.ForeignKey(Profile, on_delete=models.CASCADE)
    course = models.ForeignKey(Course, on_delete=models.CASCADE)
    enrollment_date = models.DateTimeField(auto_now_add=True)
    completion_date = models.DateTimeField(null=True, blank=True)
    status = models.CharField(max_length=255, default="enrolled")
    progress = models.FloatField(default=0.0)

    def __str__(self):
        return f"{self.student.username} - {self.course.name}"

class SegmentReplay(models.Model):
    student = models.ForeignKey(Profile, on_delete=models.CASCADE)
    segment = models.ForeignKey(Segment, on_delete=models.CASCADE)
    question = models.ForeignKey(Question, on_delete=models.CASCADE)
    replay_count = models.IntegerField(default=0)
    last_replayed = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.student.username} - {self.segment.video.title}"

class ChapterCompletion(models.Model):
    student = models.ForeignKey(Profile, on_delete=models.CASCADE)
    chapter = models.ForeignKey(Chapter, on_delete=models.CASCADE)
    completion_percentage = models.DecimalField(max_digits=5, decimal_places=2, default=0.00)
    last_updated = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.student.username} - {self.chapter.title}"

class CourseCompletion(models.Model):
    student = models.ForeignKey(Profile, on_delete=models.CASCADE)
    course = models.ForeignKey(Course, on_delete=models.CASCADE)
    completion_percentage = models.DecimalField(max_digits=5, decimal_places=2, default=0.00)
    last_updated = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.student.username} - {self.course.name}"

class AssessmentAttempt(models.Model):
    student = models.ForeignKey(Profile, on_delete=models.CASCADE)
    assessment = models.ForeignKey(Quiz, on_delete=models.CASCADE)
    attempt_number = models.IntegerField()
    attempt_date = models.DateTimeField(auto_now_add=True)
    score = models.DecimalField(max_digits=5, decimal_places=2)
    max_score = models.DecimalField(max_digits=5, decimal_places=2)
    is_pass = models.BooleanField()
    time_taken = models.IntegerField(null=True, blank=True)

    def __str__(self):
        return f"{self.student.username} - {self.assessment.title}"

class QuestionGroup(models.Model):
    question = models.ForeignKey(Question, on_delete=models.CASCADE)
    question_no = models.IntegerField()

    def __str__(self):
        return f"{self.question.question} - {self.question_no}"

class Group(models.Model):
    name = models.CharField(max_length=255, unique=True)
    description = models.TextField(null=True, blank=True)
    is_public = models.BooleanField(default=False)

    def __str__(self):
        return self.name

class Program(models.Model):
    name = models.CharField(max_length=255, unique=True)
    description = models.TextField(null=True, blank=True)
    duration = models.IntegerField()

    def __str__(self):
        return self.name

class ProgramGroupMapping(models.Model):
    institute = models.ForeignKey(Institution, on_delete=models.CASCADE)
    program = models.ForeignKey(Program, on_delete=models.CASCADE)
    group = models.ForeignKey(Group, on_delete=models.CASCADE)
    sequence = models.IntegerField()

    def __str__(self):
        return f"{self.program.name} - {self.group.name}"

class AssessmentGroup(models.Model):
    name = models.CharField(max_length=255)
    description = models.TextField(null=True, blank=True)
    is_sequential = models.BooleanField(default=False)

    def __str__(self):
        return self.name

class AssessmentGroupMapping(models.Model):
    assessment = models.ForeignKey(Quiz, on_delete=models.CASCADE)
    group = models.ForeignKey(AssessmentGroup, on_delete=models.CASCADE)
    sequence = models.IntegerField(null=True, blank=True)

    def __str__(self):
        return f"{self.assessment.title} - {self.group.name}"

class StudyMaterial(models.Model):
    chapter = models.ForeignKey(Chapter, on_delete=models.CASCADE)
    name = models.CharField(max_length=255)
    description = models.TextField(null=True, blank=True)
    type = models.CharField(max_length=50)
    content = models.TextField()
    is_ordered = models.BooleanField(default=False)

    def __str__(self):
        return self.name

class StudyMaterialSection(models.Model):
    name = models.CharField(max_length=255)
    description = models.TextField(null=True, blank=True)
    is_ordered = models.BooleanField(default=False)

    def __str__(self):
        return self.name

class StudyMaterialSectionMapping(models.Model):
    study_material = models.ForeignKey(StudyMaterial, on_delete=models.CASCADE)
    section = models.ForeignKey(StudyMaterialSection, on_delete=models.CASCADE)
    sequence = models.IntegerField(null=True, blank=True)

    def __str__(self):
        return f"{self.study_material.name} - {self.section.name}"

class Feedback(models.Model):
    content_type = models.CharField(max_length=50)
    content_id = models.IntegerField()
    user = models.ForeignKey(Profile, on_delete=models.CASCADE)
    feedback_type = models.CharField(max_length=50)
    description = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.user.username} - {self.content_type}"

class Rating(models.Model):
    content_type = models.CharField(max_length=50)
    content_id = models.IntegerField()
    user = models.ForeignKey(Profile, on_delete=models.CASCADE)
    rating = models.IntegerField()
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.user.username} - {self.content_type}"

class CourseHistory(models.Model):
    course = models.ForeignKey(Course, on_delete=models.CASCADE)
    start_date = models.DateField()
    end_date = models.DateField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.course.name} - {self.start_date}"

class QuestionMediaMapping(models.Model):
    question = models.ForeignKey(Question, on_delete=models.CASCADE)
    article = models.ForeignKey(Article, on_delete=models.CASCADE, null=True, blank=True)
    segment = models.ForeignKey(Segment, on_delete=models.CASCADE, null=True, blank=True)

    def __str__(self):
        return f"{self.question.question} - {self.article.title if self.article else self.segment.video.title}"

class QuestionGroupMediaMapping(models.Model):
    question_group = models.ForeignKey(QuestionGroup, on_delete=models.CASCADE)
    article = models.ForeignKey(Article, on_delete=models.CASCADE, null=True, blank=True)
    segment = models.ForeignKey(Segment, on_delete=models.CASCADE, null=True, blank=True)

    def __str__(self):
        return f"{self.question_group.question.question} - {self.article.title if self.article else self.segment.video.title}"

class loginTokens(models.Model):
    user = models.ForeignKey(Profile, on_delete=models.CASCADE)
    token = models.CharField(max_length=255)
    refresh_token = models.CharField(max_length=255)
    expiry = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.user.username} - {self.token[:5]}"
    