from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status
from home.serializers import ProgramGroupMappingSerializer
from .models import ProgramGroupMapping

@api_view(['GET', 'POST', 'DELETE', 'PUT'])
def programGroupMap(request):
    # GET request: Fetch records based on filters (institute name, program name, group name) or all if no filters
    if request.method == 'GET':
        filters = {
            'institute__name': request.query_params['institute'] if 'institute' in request.query_params else '',
            'program__name': request.query_params['program'] if 'program' in request.query_params else '',
            'group__name': request.query_params['group'] if 'group' in request.query_params else ''
        }

        program_group_mappings = ProgramGroupMapping.objects.filter(**filters)

        if program_group_mappings.exists():
            serializer = ProgramGroupMappingSerializer(program_group_mappings, many=True)
            return Response(serializer.data)
        else:
            return Response({'error': 'No ProgramGroupMapping records found matching the filters'}, status=status.HTTP_404_NOT_FOUND)

    # POST request: Create a new ProgramGroupMapping record
    elif request.method == 'POST':
        serializer = ProgramGroupMappingSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    # PUT request: Update an existing ProgramGroupMapping record based on filters
    elif request.method == 'PUT':
        filters = {}
        if 'institute' in request.data:
            filters['institute__name'] = request.data['institute']
        if 'program' in request.data:
            filters['program__name'] = request.data['program']
        if 'group' in request.data:
            filters['group__name'] = request.data['group']

        try:
            program_group_mapping = ProgramGroupMapping.objects.get(**filters)
            serializer = ProgramGroupMappingSerializer(program_group_mapping, data=request.data, partial=False)
            if serializer.is_valid():
                serializer.save()
                return Response(serializer.data)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        except ProgramGroupMapping.DoesNotExist:
            return Response({'error': 'ProgramGroupMapping not found matching the filters'}, status=status.HTTP_404_NOT_FOUND)

    # DELETE request: Delete a ProgramGroupMapping record based on filters
    elif request.method == 'DELETE':
        filters = {}
        if 'institute' in request.data:
            filters['institute__name'] = request.data['institute']
        if 'program' in request.data:
            filters['program__name'] = request.data['program']
        if 'group' in request.data:
            filters['group__name'] = request.data['group']

        try:
            program_group_mapping = ProgramGroupMapping.objects.get(**filters)
            program_group_mapping.delete()
            return Response({'message': 'ProgramGroupMapping deleted successfully'}, status=status.HTTP_204_NO_CONTENT)
        except ProgramGroupMapping.DoesNotExist:
            return Response({'error': 'ProgramGroupMapping not found matching the filters'}, status=status.HTTP_404_NOT_FOUND)
