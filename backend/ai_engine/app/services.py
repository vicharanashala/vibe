from app.question_generation.services import VideoProcessor, PlaylistProcessor, GeminiService, OllamaService
from typing import List
from dotenv import load_dotenv
import os

load_dotenv()

# def process_question_generation(transcript: str):
#     return generate_question(transcript)

# def process_answer_question(question: str):
#     return answer_question(question)

# ai_service = GeminiService()
playlist_processor = PlaylistProcessor()
# video_processor = VideoProcessor(ai_service)

async def process_process_video(url: str, user_api_key: str, timestamps: List[int],
                          segment_wise_q_no: List[int],
                          segment_wise_q_model: List[str]):
    if user_api_key == "ollama1064":
        ai_service = OllamaService()
        print("Using OLLAAAAMMMAAAAAAAAAAA AI")
    else:
        ai_service = GeminiService()
        ai_service.set_api_key(os.getenv("API_KEY"))
    video_processor = VideoProcessor(ai_service)
    result = await video_processor.process_video(url, user_api_key, timestamps, segment_wise_q_no,
                         segment_wise_q_model)
    return result

async def get_urls(url: str):
    urls = await playlist_processor.get_urls_from_playlist(url)
    return urls
# Compare this snippet from app/routers/video.py:
# from fastapi import APIRouter
# from app.schemas import VideoRequest, VideoResponse
# from app.services import process_video
