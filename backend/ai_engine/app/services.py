from app.models import process_video, get_urls_from_playlist
from typing import List

# def process_question_generation(transcript: str):
#     return generate_question(transcript)

# def process_answer_question(question: str):
#     return answer_question(question)


def process_process_video(url: str, user_api_key: str, timestamps: List[int],
                          segment_wise_q_no: List[int],
                          segment_wise_q_model: List[str]):
    return process_video(url, user_api_key, timestamps, segment_wise_q_no,
                         segment_wise_q_model)


def get_urls(url: str):
    return get_urls_from_playlist(url)
# Compare this snippet from app/routers/video.py:
# from fastapi import APIRouter
# from app.schemas import VideoRequest, VideoResponse
# from app.services import process_video
