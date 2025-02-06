import whisper
import asyncio
from typing import Dict

whisper_model = whisper.load_model("base")

async def process_audio(segment_file: str, start_time: float, end_time: float) -> Dict:
    result = await asyncio.to_thread(whisper_model.transcribe, segment_file)
    return {
        "text": result["text"],
        "start_time": start_time,
        "end_time": end_time,
    }