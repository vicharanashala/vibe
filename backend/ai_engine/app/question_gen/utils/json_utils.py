import json
from typing import Dict

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
        # Extract and parse JSON content
        start_idx = text.find("{")
        end_idx = text.rfind("}") + 1
        if start_idx == -1 or end_idx == -1:
            return empty_response
            
        json_part = text[start_idx:end_idx]
        parsed_data = json.loads(json_part)
        
        # Validate parsed data structure
        if not isinstance(parsed_data, dict):
            return empty_response
        if "questions" not in parsed_data:
            parsed_data["questions"] = empty_response["questions"]
            
        return parsed_data
    except (json.JSONDecodeError, ValueError) as e:
        print(f"Failed to parse JSON: {e}, returning empty structured result")
        return empty_response