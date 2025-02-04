from pydantic import BaseModel
from typing import List, Dict

# class QuestionGenerationRequest(BaseModel):
#     transcript: str

# class QuestionGenerationResponse(BaseModel):
#     question: str
#     options: List[str]
#     correct_answer: str

# class AnswerQuestionRequest(BaseModel):
#     question: str

# class AnswerQuestionResponse(BaseModel):
#     answer: str


# Pydantic Model for request data
class VideoRequest(BaseModel):
    url: str
    user_api_key: str
    timestamps: List[int]  # in seconds
    segment_wise_q_no: List[int]
    segment_wise_q_model: List[str]


# Pydantic Model for the output response
class Segment(BaseModel):
    text: str
    start_time: float
    end_time: float


class Question(BaseModel):
    question: str
    options: List[str]
    correct_answer: int
    segment: int


class VideoResponse(BaseModel):
    # video_url: str
    # title: str
    # description: str
    segments: List[Dict]
    questions: List[Dict]


class URLRequest(BaseModel):
    url: str
