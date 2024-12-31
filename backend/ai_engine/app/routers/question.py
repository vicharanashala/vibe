from fastapi import APIRouter
from app.schemas import (
    VideoRequest,
    URLRequest,
)
from app.services import process_process_video, get_urls

router = APIRouter(prefix="/questions", tags=["Questions"])


@router.post("/process_video")
def generate_question(request: VideoRequest):
    result = process_process_video(request.url, request.user_api_key,
                                   request.timestamps,
                                   request.segment_wise_q_no,
                                   request.segment_wise_q_model)
    return result


@router.post("/get_urls")
def get_list_of_links(request: URLRequest):
    result = get_urls(request.url)
    return result
# @router.post("/answer", response_model=AnswerQuestionResponse)
# def answer_question(request: AnswerQuestionRequest):
#     answer = process_answer_question(request.question)
#     return {"answer": answer}
