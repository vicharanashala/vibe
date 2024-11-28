from django.db import models

class Assessment(models.Model):
    title = models.CharField(max_length=255)
    course = models.ForeignKey('course.Course', on_delete=models.CASCADE)
    type = models.CharField(max_length=50, choices=[('Quiz', 'Quiz'), ('Assignment', 'Assignment'), ('Exam', 'Exam')])
    deadline = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.title

class Question(models.Model):
    text = models.TextField()
    type = models.CharField(max_length=20, choices=[('MCQ', 'MCQ'), ('MSQ', 'MSQ'), ('NAT', 'NAT'), ('DESC', 'DESC')])
    time_limit = models.PositiveIntegerField(null=True, blank=True)
    assessment = models.ForeignKey(Assessment, on_delete=models.CASCADE, related_name='questions')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.text

class QuestionOption(models.Model):
    question = models.ForeignKey(Question, on_delete=models.CASCADE, related_name='options')
    option_text = models.TextField()
    is_correct = models.BooleanField(default=False)

    def __str__(self):
        return self.option_text

class AssessmentGrading(models.Model):
    assessment = models.ForeignKey(Assessment, on_delete=models.CASCADE)
    grading_status = models.CharField(max_length=50, default="pending")
    graded_at = models.DateTimeField(null=True, blank=True)
