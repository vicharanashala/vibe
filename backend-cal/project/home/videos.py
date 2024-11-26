# pip install openai openai-whisper pytubefix pydub ffmpeg

from rest_framework.decorators import api_view
from rest_framework.response import Response
from home.serializers import VideoSerializer
from .models import Video
from pytubefix import YouTube
from pytubefix.cli import on_progress
from pydub import AudioSegment
import whisper
import os
import uuid

# Utility function to generate a transcript
def generate_transcript_from_url(url):
    unique_id = str(uuid.uuid4())[:8]  # Shorten UUID for brevity
    m4a_file = f"{unique_id}"
    wav_file = f"{unique_id}.wav"

    try:
        # Step 1: Download audio from YouTube
        yt = YouTube(url, on_progress_callback=on_progress)
        print(f"Downloading audio for video: {yt.title}")
        ys = yt.streams.get_audio_only()
        ys.download(filename=m4a_file)

        # Step 2: Convert .m4a to .wav
        audio = AudioSegment.from_file(f"{m4a_file}.m4a", format="m4a")
        audio.export(wav_file, format="wav")
        print(f"Conversion complete: {wav_file}")

        # Step 3: Transcribe audio using Whisper
        model = whisper.load_model("base")
        print("Generating transcript...")
        result = model.transcribe(wav_file)
        transcript = result["text"]

        # Step 4: Clean up temporary files
        os.remove(f"{m4a_file}.m4a")
        os.remove(wav_file)
        print(f"Temporary files deleted: {m4a_file}.m4a, {wav_file}")

        return transcript
    except Exception as e:
        print(f"Error during transcription: {e}")
        return None

# API view for video operations
@api_view(['GET', 'POST', 'PUT', 'DELETE'])
def videos(request):
    if request.method == 'GET':
        args = request.GET.get("search")
        if args:
            videos = Video.objects.filter(title__icontains=args)
            if not videos:
                return Response({'error': 'Video not found'})
        else:
            videos = Video.objects.all()
        serializer = VideoSerializer(videos, many=True)
        return Response(serializer.data)

    if request.method == 'POST':
        # Check if video already exists
        videos = Video.objects.filter(link=request.data.get('link'))
        if videos:
            return Response({'error': 'Video already exists'})

        # Generate transcript for the video URL
        video_url = request.data.get('link')
        if video_url:
            transcript = generate_transcript_from_url(video_url)
            if transcript:
                request.data['transcript'] = transcript  # Add transcript to the request data
            else:
                return Response({'error': 'Failed to generate transcript'})

        serializer = VideoSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors)

    if request.method == 'PUT':
        # Update video details
        video_id = request.data.get('id')
        if not video_id:
            return Response({'error': 'Video ID is required for update'})
        
        try:
            video = Video.objects.get(pk=video_id)
        except Video.DoesNotExist:
            return Response({'error': 'Video not found'})

        # Optionally regenerate transcript if the link is updated
        if 'link' in request.data and request.data['link'] != video.link:
            transcript = generate_transcript_from_url(request.data['link'])
            if transcript:
                request.data['transcript'] = transcript

        serializer = VideoSerializer(video, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors)

    if request.method == 'DELETE':
        # Delete a video record
        video_id = request.data.get('id')
        if not video_id:
            return Response({'error': 'Video ID is required for deletion'})
        
        try:
            video = Video.objects.get(pk=video_id)
            video.delete()
            return Response({'success': 'Video deleted'})
        except Video.DoesNotExist:
            return Response({'error': 'Video not found'})