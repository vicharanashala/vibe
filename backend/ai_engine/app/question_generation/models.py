from pydantic import BaseModel
from typing import List, Optional

class VideoSegment(BaseModel):
    text: str
    start_time: float
    end_time: float
    title: Optional[str] = None
    video_url: Optional[str] = None
    description: Optional[str] = None

class Question(BaseModel):
    question: str
    option_1: str
    option_2: str
    option_3: str
    option_4: str
    correct_answer: int
    segment: int

class VideoResponse(BaseModel):
    segments: List[VideoSegment]
    questions: List[Question]