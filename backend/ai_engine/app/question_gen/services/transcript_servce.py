from youtube_transcript_api import YouTubeTranscriptApi
import asyncio
from typing import List, Dict

async def get_raw_transcript(video_id: str) -> List[Dict]:
    try:
        transcript = await asyncio.to_thread(YouTubeTranscriptApi.get_transcript, video_id)
        return transcript
    except Exception:
        return []

def generate_transcript_segments(transcript: List[Dict], timestamps: List[int]) -> List[Dict]:
    duration = max(item["start"] + item["duration"] for item in transcript)
    if not timestamps:
        segment_count = 4
        timestamps = [i * (duration // segment_count) for i in range(0, segment_count)]
    
    timestamps = sorted(timestamps)
    timestamps.append(duration + 1)
    
    segments = []
    time_ranges = []
    current_segment = []
    segment_index = 0
    
    for entry in transcript:
        while (segment_index + 1 < len(timestamps) and 
               entry["start"] >= timestamps[segment_index + 1]):
            if current_segment:
                segments.append(" ".join(current_segment))
                time_ranges.append((timestamps[segment_index], 
                                  timestamps[segment_index + 1]))
            current_segment = []
            segment_index += 1
        
        current_segment.append(entry["text"])
    
    if current_segment:
        segments.append(" ".join(current_segment))
        time_ranges.append((timestamps[segment_index], timestamps[segment_index + 1]))
    
    return [
        {"text": segment, "start_time": start, "end_time": end}
        for segment, (start, end) in zip(segments, time_ranges)
    ]