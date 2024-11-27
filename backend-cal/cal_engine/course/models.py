from django.db import models

class Course(models.Model):
    name = models.CharField(max_length=255, unique=True)
    description = models.TextField()
    visibility = models.CharField(max_length=50, default='public')
    institution = models.ForeignKey('institution.Institution', on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name

class Chapter(models.Model):
    title = models.CharField(max_length=255)
    description = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.title

class CourseChapter(models.Model):
    course = models.ForeignKey(Course, on_delete=models.CASCADE)
    chapter = models.ForeignKey(Chapter, on_delete=models.CASCADE)
    sequence = models.PositiveIntegerField()

    class Meta:
        unique_together = ('course', 'chapter')

