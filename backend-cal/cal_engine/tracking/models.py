from django.db import models

class StudySession(models.Model):
    user = models.ForeignKey('user.User', on_delete=models.CASCADE)
    chapter = models.ForeignKey('course.Chapter', on_delete=models.CASCADE)
    start_time = models.DateTimeField(auto_now_add=True)
    end_time = models.DateTimeField(null=True, blank=True)
    duration = models.PositiveIntegerField(default=0)

    def __str__(self):
        return f"{self.user.username} - {self.chapter.title}"

class SessionViolation(models.Model):
    session = models.ForeignKey(StudySession, on_delete=models.CASCADE, related_name='violations')
    violation_type = models.CharField(max_length=50, choices=[('absence_on_screen', 'Absence on Screen'), ('multiple_people', 'Multiple People'), ('video_blur', 'Video Blur'),('inactive','Inactive')])
    timestamp = models.DateTimeField(auto_now_add=True)

class ChapterCompletion(models.Model):
    user = models.ForeignKey('user.User', on_delete=models.CASCADE)
    chapter = models.ForeignKey('course.Chapter', on_delete=models.CASCADE)
    completion_percentage = models.DecimalField(max_digits=5, decimal_places=2, default=0.00)
    last_updated = models.DateTimeField(auto_now=True)
