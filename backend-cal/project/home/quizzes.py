from rest_framework.decorators import api_view
from rest_framework.response import Response
from home.serializers import QuizSerializer
from .models import Quiz, Course, Chapter

@api_view(['GET', 'POST', 'DELETE', 'PUT'])
def quizzes(request):

    if request.method == 'GET':
        # Filter quizzes by course or chapter
        course_id = request.GET.get("course_id")
        chapter_id = request.GET.get("chapter_id")

        if course_id:
            try:
                course = Course.objects.get(pk=course_id)
                quizzes = Quiz.objects.filter(course=course)
                if not quizzes:
                    return Response({'error': 'No quizzes found for the specified course'})
            except Course.DoesNotExist:
                return Response({'error': 'Course not found'})
        elif chapter_id:
            try:
                chapter = Chapter.objects.get(pk=chapter_id)
                quizzes = Quiz.objects.filter(chapter=chapter)
                if not quizzes:
                    return Response({'error': 'No quizzes found for the specified chapter'})
            except Chapter.DoesNotExist:
                return Response({'error': 'Chapter not found'})
        else:
            quizzes = Quiz.objects.all()

        serializer = QuizSerializer(quizzes, many=True)
        return Response(serializer.data)

    if request.method == 'POST':
        # Ensure course and chapter IDs are provided
        course_id = request.data.get("course_id")
        chapter_id = request.data.get("chapter_id")

        if not course_id or not chapter_id:
            return Response({'error': 'Both course_id and chapter_id are required'})

        # Validate the existence of the course and chapter
        try:
            course = Course.objects.get(id=course_id)
        except Course.DoesNotExist:
            return Response({'error': 'Course not found'})

        try:
            chapter = Chapter.objects.get(id=chapter_id)
        except Chapter.DoesNotExist:
            return Response({'error': 'Chapter not found'})

        # Create the quiz
        data = request.data
        data['course'] = course.id
        data['chapter'] = chapter.id
        serializer = QuizSerializer(data=data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors)

    if request.method == 'DELETE':
        # Ensure quiz ID is provided
        quiz_id = request.data.get("id")
        if not quiz_id:
            return Response({'error': 'Quiz ID is required for deletion'})

        # Validate the existence of the quiz
        try:
            quiz = Quiz.objects.get(id=quiz_id)
        except Quiz.DoesNotExist:
            return Response({'error': 'Quiz not found'})

        # Delete the quiz
        quiz.delete()
        return Response({'success': 'Quiz deleted'})

    if request.method == 'PUT':
        # Ensure quiz ID is provided
        quiz_id = request.data.get("id")
        if not quiz_id:
            return Response({'error': 'Quiz ID is required for update'})

        # Validate the existence of the quiz
        try:
            quiz = Quiz.objects.get(id=quiz_id)
        except Quiz.DoesNotExist:
            return Response({'error': 'Quiz not found'})

        # Update the quiz
        serializer = QuizSerializer(quiz, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors)
