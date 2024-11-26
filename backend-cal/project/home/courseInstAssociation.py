from rest_framework.decorators import api_view
from rest_framework.response import Response
from home.serializers import CourseInstructorAssociationSerializer
from .models import CourseInstructorAssociation, Profile, Course

@api_view(['GET', 'POST', 'DELETE', 'PUT'])
def course_instructor_associations(request):

    if request.method == 'GET':
        # Filter associations based on course or instructor
        course_id = request.GET.get("course_id")
        instructor_id = request.GET.get("instructor_id")

        if course_id:
            try:
                course = Course.objects.get(pk=course_id)
                associations = CourseInstructorAssociation.objects.filter(course=course)
                if not associations:
                    return Response({'error': 'No associations found for the specified course'})
            except Course.DoesNotExist:
                return Response({'error': 'Course not found'})
        elif instructor_id:
            try:
                instructor = Profile.objects.get(pk=instructor_id)
                associations = CourseInstructorAssociation.objects.filter(instructor=instructor)
                if not associations:
                    return Response({'error': 'No associations found for the specified instructor'})
            except Profile.DoesNotExist:
                return Response({'error': 'Instructor not found'})
        else:
            associations = CourseInstructorAssociation.objects.all()

        serializer = CourseInstructorAssociationSerializer(associations, many=True)
        return Response(serializer.data)

    if request.method == 'POST':
        # Ensure course and instructor IDs are provided
        course_id = request.data.get("course_id")
        instructor_id = request.data.get("instructor_id")

        if not course_id or not instructor_id:
            return Response({'error': 'Both course_id and instructor_id are required'})

        # Validate existence of course and instructor
        try:
            course = Course.objects.get(pk=course_id)
        except Course.DoesNotExist:
            return Response({'error': 'Course not found'})
        
        try:
            instructor = Profile.objects.get(pk=instructor_id)
        except Profile.DoesNotExist:
            return Response({'error': 'Instructor not found'})

        # Check for duplicate association
        existing_association = CourseInstructorAssociation.objects.filter(course=course, instructor=instructor).first()
        if existing_association:
            return Response({'error': 'Association already exists'})

        # Create the association
        data = request.data
        data['course'] = course.id
        data['instructor'] = instructor.id
        serializer = CourseInstructorAssociationSerializer(data=data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors)

    if request.method == 'DELETE':
        # Ensure the association ID is provided
        association_id = request.data.get("id")
        if not association_id:
            return Response({'error': 'Association ID is required for deletion'})

        # Validate existence of the association
        try:
            association = CourseInstructorAssociation.objects.get(pk=association_id)
        except CourseInstructorAssociation.DoesNotExist:
            return Response({'error': 'Association not found'})

        # Delete the association
        association.delete()
        return Response({'success': 'Association deleted'})

    if request.method == 'PUT':
        # Ensure the association ID is provided
        association_id = request.data.get("id")
        if not association_id:
            return Response({'error': 'Association ID is required for update'})

        # Validate existence of the association
        try:
            association = CourseInstructorAssociation.objects.get(pk=association_id)
        except CourseInstructorAssociation.DoesNotExist:
            return Response({'error': 'Association not found'})

        # Update the association
        serializer = CourseInstructorAssociationSerializer(association, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors)
