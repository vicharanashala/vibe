from django.db import models

class Feedback(models.Model):
    user = models.ForeignKey('user.User', on_delete=models.CASCADE)
    content_type = models.CharField(max_length=50, help_text="Type of content: question, video, article, etc.")
    content_id = models.PositiveIntegerField(help_text="ID of the associated content")
    feedback_type = models.CharField(max_length=50, choices=[('Suggestion', 'Suggestion'), ('Issue', 'Issue')])
    description = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.user.username} - {self.feedback_type}"
