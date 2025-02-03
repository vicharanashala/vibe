# tests/test_signals.py
# from django.test import TestCase
# from ...course.models import CourseAssessmentCount
# from .factories import CourseFactory, AssessmentFactory
#
# class TestAssessmentCountSignals(TestCase):
#     def setUp(self):
#         self.course = CourseFactory()
#
#     def test_assessment_count_increments_on_creation(self):
#         initial_count = self.course.assessment_count.count
#         AssessmentFactory(section__module__course=self.course)
#         final_count = CourseAssessmentCount.objects.get(
#             course=self.course
#         ).count
#         assert final_count == initial_count + 1