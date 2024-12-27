from rest_framework import viewsets
from rest_framework.exceptions import NotFound
from ..models import Question
from ..serializers import QuestionSerializer


class QuestionViewSet(viewsets.ModelViewSet):
    queryset = Question.objects.all()
    serializer_class = QuestionSerializer

    def list(self, request, *args, **kwargs):
        assessment_id = self.request.query_params.get('assessment_id') # type: ignore
        if assessment_id is not None:
            queryset = Question.objects.filter(assessment_id=assessment_id)
            serializer = self.get_serializer(self.paginate_queryset(queryset), many=True)
            return self.get_paginated_response(serializer.data)

        raise NotFound("You must specify 'assessment_id'.")
