from rest_framework.decorators import api_view
from rest_framework.response import Response
from home.serializers import SegmentSerializer
from .models import Segment, Video

@api_view(['GET', 'POST', 'DELETE', 'PUT'])
def segments(request):
    if request.method == 'GET':
        args = request.GET.get("video_id")
        if args:
            try:
                video = Video.objects.get(pk=args)
                segments = Segment.objects.filter(video=video)
                if not segments:
                    return Response({'error': 'No segments found for the specified video'})
            except Video.DoesNotExist:
                return Response({'error': 'Video not found'})
        else:
            segments = Segment.objects.all()
        serializer = SegmentSerializer(segments, many=True)
        return Response(serializer.data)
    
    if request.method == 'POST':
        # Ensure the video ID is provided
        video_id = request.data.get('video_id')
        if not video_id:
            return Response({'error': 'Video ID is required'})

        # Check if the specified video exists
        try:
            video = Video.objects.get(pk=video_id)
        except Video.DoesNotExist:
            return Response({'error': 'Video not found'})
        
        # Create the segment
        data = request.data
        data['video'] = video.id  # Ensure the video field is set
        serializer = SegmentSerializer(data=data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors)
    
    if request.method == 'DELETE':
        # Ensure the segment ID is provided
        segment_id = request.data.get('id')
        if not segment_id:
            return Response({'error': 'Segment ID is required for deletion'})
        
        # Check if the specified segment exists
        try:
            segment = Segment.objects.get(pk=segment_id)
        except Segment.DoesNotExist:
            return Response({'error': 'Segment not found'})
        
        # Delete the segment
        segment.delete()
        return Response({'success': 'Segment deleted'})
    
    if request.method == 'PUT':
        # Ensure the segment ID is provided
        segment_id = request.data.get('id')
        if not segment_id:
            return Response({'error': 'Segment ID is required for update'})
        
        # Check if the specified segment exists
        try:
            segment = Segment.objects.get(pk=segment_id)
        except Segment.DoesNotExist:
            return Response({'error': 'Segment not found'})
        
        # Update the segment
        serializer = SegmentSerializer(segment, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors)
