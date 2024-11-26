from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status
from home.serializers import CourseSerializer
from .models import Course
from datetime import datetime

@api_view(['GET', 'POST', 'DELETE', 'PUT'])
def courses(request):

    # GET request: Fetch courses based on search query or return all courses
    if request.method == 'GET':
        args = request.GET.get("search")
        if args:
            courses = Course.objects.filter(name__icontains=args)
            if not courses:
                return Response({'error': 'No courses found matching the search query'}, status=status.HTTP_404_NOT_FOUND)
        else:
            courses = Course.objects.all()
        serializer = CourseSerializer(courses, many=True)
        return Response(serializer.data)

    # POST request: Create a new course
    elif request.method == 'POST':
        
        # Check if a similar course already exists
        existing_course = Course.objects.filter(name__icontains=request.data.get('name'))
        if existing_course:
            return Response({'error': 'A course with this name already exists'}, status=status.HTTP_400_BAD_REQUEST)
        
        serializer = CourseSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    # DELETE request: Delete a course by its name
    elif request.method == 'DELETE':
        course_name = request.data.get('name')
        if not course_name:
            return Response({'error': 'Course name is required for deletion'}, status=status.HTTP_400_BAD_REQUEST)
        
        course = Course.objects.filter(name__icontains=course_name).first()
        if not course:
            return Response({'error': 'Course not found'}, status=status.HTTP_404_NOT_FOUND)
        
        course.delete()
        return Response({'success': 'Course deleted successfully'}, status=status.HTTP_204_NO_CONTENT)

    # PUT request: Update an existing course by its name
    elif request.method == 'PUT':
        course_name = request.data.get('name')
        if not course_name:
            return Response({'error': 'Course name is required for update'}, status=status.HTTP_400_BAD_REQUEST)
        
        course = Course.objects.filter(name__icontains=course_name).first()
        if not course:
            return Response({'error': 'Course not found'}, status=status.HTTP_404_NOT_FOUND)
        
        serializer = CourseSerializer(course, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)