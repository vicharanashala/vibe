from rest_framework.decorators import api_view
from rest_framework.response import Response
from home.serializers import  GroupSerializer
from .models import Group
from datetime import datetime
from rest_framework.authtoken.views import ObtainAuthToken
from home.auth import check_auth

@api_view(['GET', 'POST', 'DELETE', 'PUT'])
def groupsRoute(request):
    if request.method == 'GET':
        user_data, auth_status = check_auth(request, ['Admin', 'User'])
        if not user_data.is_anonymous:
            args = request.GET.get("search")
            if args:
                groups = Group.objects.filter(name__icontains=args)
                if not groups:
                    return Response({'error': 'Program not found'})
            else:
                groups = Group.objects.all()
            serializer = GroupSerializer(groups, many=True)
            return Response(serializer.data)
    

    if request.method == 'POST':
        groups = Group.objects.filter(name=request.data.get('name'))
        if groups:
            return Response({'error': 'Group already exists'})
        serializer = GroupSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors)
    

    if request.method == 'DELETE':
        groups = Group.objects.filter(name=request.data.get('name'))
        if not groups:
            return Response({'error': 'Group not found'})
        groups.delete()
        return Response({'success': 'Group deleted'})
    
    
    if request.method == 'PUT':
        groups = Group.objects.filter(name=request.data.get('name'))
        if not groups:
            return Response({'error': 'Group not found'})
        serializer = GroupSerializer(groups[0], data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors)
