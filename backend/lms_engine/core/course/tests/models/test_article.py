# tests/models/test_article.py
from django.test import TestCase
from django.utils import timezone

from core.course.models import Article
from core.course.tests.factories import UserFactory


class TestArticle(TestCase):
    def setUp(self):
        self.article = Article.objects.create(content="Test article content")
        self.admin_user = UserFactory(role="admin")

    def test_article_creation(self):
        self.assertIsInstance(self.article, Article)
        self.assertEqual(self.article.content, "Test article content")
        self.assertIsNotNone(self.article.created_at)
        self.assertIsNotNone(self.article.updated_at)

    def test_admin_access(self):
        read, write, delete = self.article.admin_has_access(self.admin_user)
        self.assertTrue(all([read, write, delete]))

    def test_update_timestamp(self):
        original_updated_at = self.article.updated_at
        self.article.content = "Updated content"
        self.article.save()
        self.assertGreater(self.article.updated_at, original_updated_at)
