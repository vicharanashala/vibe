from pydantic import BaseModel
from typing import List, Dict

class VideoResponse(BaseModel):
    segments: List[Dict]
    questions: List[Dict]