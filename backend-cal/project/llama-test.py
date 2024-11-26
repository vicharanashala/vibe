import ollama
import re
import json

def generate_questions_from_transcript(filename, model='llama3.2'):
    task_description = """
        You are an AI tasked with generating multiple-choice questions (MCQs) from a given transcript. 
        Your goal is to:
        1. Identify important concepts, events, or details in the transcript.
        2. Frame questions in a simple and clear manner based on these concepts.
        3. Provide 4 answer options for each question, ensuring one is correct and the others are plausible but incorrect.
        4. Specify the index (0-based) of the correct answer for each question.
        5. Format your response as a JSON list where each entry follows the structure:
        { "question": "<question_text>", "options": ["<option1>", "<option2>", "<option3>", "<option4>"], "correct_answer": <index_of_correct_option> }

        Example output:
        [
            {
                "question": "What is the capital of France?",
                "options": ["Berlin", "Madrid", "Paris", "Rome"],
                "correct_answer": 2
            },
            {
                "question": "Which planet is known as the Red Planet?",
                "options": ["Earth", "Mars", "Jupiter", "Venus"],
                "correct_answer": 1
            },
            {
                "question": "What is the chemical symbol for water?",
                "options": ["H2O", "O2", "CO2", "NaCl"],
                "correct_answer": 0
            }
        ]
        Your input will be a transcript, and you will generate 3 questions based on its content in this exact format.
    """

    with open(filename, 'r') as file:
        transcript = file.read()

    segments = re.split(r'---Segment \d+ Transcript:\n', transcript)[1:]  # Skip first empty match
    segment_questions = {}


    for i, segment in enumerate(segments, start=1):
        prompt = task_description + '\n Here is the transcript content: \n' + segment + 'Generate 3 questions as a JSON list, each question following the specified json format { "question": "<question_text>", "options": ["<option1>", "<option2>", "<option3>", "<option4>"], "correct_answer": <index_of_correct_option> }.'
        response = ollama.generate(model=model, prompt=prompt)
        print(response)

    # Extract JSON from the response using regex
    # After extracting and correcting the JSON
        json_match = re.search(r'\[\s*(\{\s*"question":\s*".+?",\s*"options":\s*\[\s*".+?"(?:,\s*".+?")*\s*\],\s*"correct_answer":\s*\d+\s*\}\s*,?\s*)+\]', response["response"], re.DOTALL)
        if json_match:
            json_string = json_match.group(0)  # Extract matched JSON substring
            corrected_json = correct_json_format(json_string, model=model)
            parsed_json = json.loads(corrected_json)

        # Check if parsed_json is a list or a single dictionary
            if isinstance(parsed_json, dict):  # If it's a single dictionary, wrap it in a list
                questions_list = [parsed_json]
            elif isinstance(parsed_json, list):  # Already a list of dictionaries
                questions_list = parsed_json
            else:
                print(f"Unexpected JSON structure for segment {i}: {parsed_json}")
                questions_list = []
        else:
            print("No valid JSON found in the response.")
            return None

# Save questions to a CSV file
    with open("output.csv", "a") as output:
    # Write a header row to the CSV for clarity
        output.write("Question,Option 1,Option 2,Option 3,Option 4,Correct Answer\n")
    
        for question in questions_list:
        # Ensure all fields are correctly written in CSV format
            output.write(
                f"\"{question['question']}\",\"{question['options'][0]}\",\"{question['options'][1]}\","
                f"\"{question['options'][2]}\",\"{question['options'][3]}\",{question['correct_answer']}\n"
            )

    return questions_list


def correct_json_format(json_string, model='llama3.2'):
    """
    Sends the JSON string to another LLM call to correct any formatting issues.
    """
    correction_prompt = f"""
        You are an AI that fixes improperly formatted JSON. Here is the input JSON:
        {json_string}

        Fix any issues such as:
        1. Missing or extra brackets, commas, or quotes.
        2. Incorrect data types or mismatched structures.
        3. Ensure the JSON is valid and conforms to the following structure:
           [
               {{
                   "question": "<question_text>",
                   "options": ["<option1>", "<option2>", "<option3>", "<option4>"],
                   "correct_answer": <index_of_correct_option>
               }}
           ]

        Return only the corrected JSON, and nothing else.
    """
    response = ollama.generate(model=model, prompt=correction_prompt)
    return response["response"]

# Example usage
questions = generate_questions_from_transcript("subtitle.txt")
print(questions)
