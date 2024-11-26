from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status
from home.serializers import QuestionSerializer
from .models import Question
from datetime import datetime

@api_view(['GET', 'POST', 'DELETE', 'PUT'])
def questions(request):
    # GET request: Fetch questions based on a search query or return all questions
    if request.method == 'GET':
        args = request.GET.get("search")
        if args:
            questions = Question.objects.filter(question__icontains=args)
            if not questions:
                return Response({'error': 'No questions found matching the search query'}, status=status.HTTP_404_NOT_FOUND)
        else:
            questions = Question.objects.all()
        serializer = QuestionSerializer(questions, many=True)
        return Response(serializer.data)

    # POST request: Create a new question
    elif request.method == 'POST':
        # Check if a similar question already exists
        existing_question = Question.objects.filter(question__icontains=request.data.get('question'))
        if existing_question:
            return Response({'error': 'A similar question already exists'}, status=status.HTTP_400_BAD_REQUEST)
        
        serializer = QuestionSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    # DELETE request: Delete a question by its text
    elif request.method == 'DELETE':
        question_text = request.data.get('question')
        if not question_text:
            return Response({'error': 'Question text is required for deletion'}, status=status.HTTP_400_BAD_REQUEST)
        
        question = Question.objects.filter(question__icontains=question_text).first()
        if not question:
            return Response({'error': 'Question not found'}, status=status.HTTP_404_NOT_FOUND)
        
        question.delete()
        return Response({'success': 'Question deleted successfully'}, status=status.HTTP_204_NO_CONTENT)

    # PUT request: Update an existing question
    elif request.method == 'PUT':
        question_text = request.data.get('question')
        if not question_text:
            return Response({'error': 'Question text is required for update'}, status=status.HTTP_400_BAD_REQUEST)
        
        question = Question.objects.filter(question__icontains=question_text).first()
        if not question:
            return Response({'error': 'Question not found'}, status=status.HTTP_404_NOT_FOUND)
        
        serializer = QuestionSerializer(question, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    