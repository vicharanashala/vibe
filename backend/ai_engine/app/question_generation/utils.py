import re
import json
from typing import Dict, Optional

def extract_video_id(url: str) -> Optional[str]:
    patterns = [
        r"(?:https?://)?(?:www\.)?youtu\.be/([^?&]+)",
        r"(?:https?://)?(?:www\.)?youtube\.com/watch\?v=([^?&]+)",
        r"(?:https?://)?(?:www\.)?youtube\.com/embed/([^?&]+)",
        r"(?:https?://)?(?:www\.)?youtube\.com/shorts/([^?&]+)",
        r"(?:https?://)?(?:www\.)?youtube\.com/live/([^?&]+)",
    ]

    for pattern in patterns:
        match = re.match(pattern, url)
        if match:
            return match.group(1)
    return None

def hide_urls(text: str) -> str:
    url_pattern = (
        r"http[s]?://(?:[a-zA-Z]|[0-9]|[$-_@.&+]|[!*\\(\\),]|"
        r"(?:%[0-9a-fA-F][0-9a-fA-F]))+"
    )
    return re.sub(url_pattern, "<url-hidden>", text)

def parse_llama_json(text: str) -> Dict:
    empty_response = {
        "questions": [
            {
                "question": "",
                "options": ["", "", "", ""],
                "correct_answer": 0
            }
        ]
    }

    try:
        start_idx = text.find("{")
        end_idx = text.rfind("}") + 1
        if start_idx == -1 or end_idx == -1:
            return empty_response

        json_part = text[start_idx:end_idx]
        parsed_data = json.loads(json_part)

        if not isinstance(parsed_data, dict):
            return empty_response
        if "questions" not in parsed_data:
            parsed_data["questions"] = empty_response["questions"]

        return parsed_data
    except:
        print(f"Failed to parse JSON, returning empty structured result")
        return empty_response