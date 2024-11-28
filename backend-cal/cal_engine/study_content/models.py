from django.db import models

class Video(models.Model):
    chapter = models.ForeignKey('course.Chapter', on_delete=models.CASCADE)
    title = models.CharField(max_length=255)
    description = models.TextField(null=True, blank=True)
    link = models.URLField()
    video_type = models.CharField(max_length=50, choices=[('reel', 'Reel'), ('lecture', 'Lecture')])
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.title

class VideoMetadata(models.Model):
    video = models.OneToOneField(Video, on_delete=models.CASCADE)
    transcript = models.TextField(null=True, blank=True)
    duration = models.PositiveIntegerField(help_text="Duration in seconds")

class Article(models.Model):
    chapter = models.ForeignKey('course.Chapter', on_delete=models.CASCADE)
    title = models.CharField(max_length=255)
    subtitle = models.CharField(max_length=255, null=True, blank=True)
    description = models.TextField()
    content_type = models.CharField(max_length=50, choices=[('markdown', 'Markdown'), ('pdf', 'PDF'), ('link', 'Link')])
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.title

class ArticleAuthor(models.Model):
    article = models.ForeignKey(Article, on_delete=models.CASCADE)
    user = models.ForeignKey('user.User', on_delete=models.CASCADE)
    role = models.CharField(max_length=50, choices=[('author', 'Author'), ('editor', 'Editor')])

class ArticleTopic(models.Model):
    article = models.ForeignKey(Article, on_delete=models.CASCADE)
    topic = models.CharField(max_length=255)
