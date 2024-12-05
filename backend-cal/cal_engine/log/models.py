from django.db import models

class Log(models.Model):
    user = models.ForeignKey('user.User', on_delete=models.SET_NULL, null=True, blank=True)
    log_type = models.CharField(max_length=50, choices=[('Activity', 'Activity'), ('Error', 'Error'), ('Audit', 'Audit')])
    severity = models.CharField(max_length=50, choices=[('Info', 'Info'), ('Warning', 'Warning'), ('Critical', 'Critical')], null=True, blank=True)
    description = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.log_type} - {self.description[:50]}"
