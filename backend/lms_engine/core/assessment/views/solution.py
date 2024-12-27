from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status
from ..models import Question, QuestionType, NATSolution, DescriptiveSolution, MCQSolution, MSQSolution
from ..serializers import (
    NATSolutionSerializer,
    DescriptiveSolutionSerializer,
    MCQSolutionSerializer,
    MSQSolutionSerializer,
)

@api_view(["GET"])
def get_solution_by_question(request, question_id):
    try:
        question = Question.objects.get(id=question_id)
    except Question.DoesNotExist:
        return Response({"error": "Question not found"}, status=status.HTTP_404_NOT_FOUND)

    question_type = question.type
    solution_data = None

    if question_type == QuestionType.NAT:
        if hasattr(question, 'natsolution'):
            solution_data = NATSolutionSerializer(question.natsolution).data # type: ignore
    elif question_type == QuestionType.DESC:
        if hasattr(question, 'descriptivesolution'):
            solution_data = DescriptiveSolutionSerializer(question.descriptivesolution).data # type: ignore
    elif question_type == QuestionType.MCQ:
        if hasattr(question, 'mcqsolution'):
            solution_data = MCQSolutionSerializer(question.mcqsolution).data # type: ignore
    elif question_type == QuestionType.MSQ:
        solution_data = MSQSolutionSerializer(MSQSolution.objects.filter(question=question), many=True).data

    if solution_data is None:
        return Response({"error": "Solution not found for the given question"}, status=status.HTTP_404_NOT_FOUND)

    return Response(
        {"question_type": question_type, "solution": solution_data},
        status=status.HTTP_200_OK,
    )
