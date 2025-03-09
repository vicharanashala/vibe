import json
import os
from groq import Groq
from tqdm import tqdm

# Set GROQ_API_KEY in your environment variables
os.environ["GROQ_API_KEY"] = "api_key"

# Create the Groq client
client = Groq(api_key=os.environ.get("GROQ_API_KEY"))

# Define the prompt templates (same as before)
prompt = {
    "role": "system",
    "content":"""
Determine the type of question (true/false, multiple-choice, multiple-select) that best fits the transcript: {transcript}
Examples:
- "The sky is blue" -> true/false
- "What color is the sky?" -> multiple-choice
- "Which colors appear in the sky?" -> multiple-select
Warning: only these 3 types should be the answer: true/false, multiple-choice, multiple-select
Format:
{{
    "question_type": "<type_of_question>"
}}
""",
}

true_false_template = {
    "role": "system",
    "content": """
    Generate a true/false question in JSON format based on the transcript: {transcript}
    {additional_suggestions}
    warning: Only return the json format and nothing more
    Format:
    {{
        "question": "<question_text>",
        "options": ["True", "False"],
        "correct_answer": <index_of_correct_option>
    }}
    """,
}

mcq_template = {
    "role": "system",
    "content": """
    Generate a multiple-choice question in JSON format based on the transcript: {transcript}
    {additional_suggestions}
    warning: Only return the json format and nothing more
    Format:
    {{
        "question": "<question_text>",
        "options": ["<option1>", "<option2>", "<option3>", "<option4>"],
        "correct_answer": <index_of_correct_option>
    }}
    """,
}

msq_template = {
    "role": "system",
    "content": """
    Generate a multiple-select question in JSON format based on the transcript: {transcript}
    {additional_suggestions}
    warning: Only return the json format and nothing more
    Format:
    {{
        "question": "<question_text>",
        "options": ["<option1>", "<option2>", "<option3>", "<option4>"],
        "correct_answer": [<index_of_correct_option1>, <index_of_correct_option2>]
    }}
    """,
}

review_template = {
    "role": "system",
    "content": """
    Review the question against the transcript: 
    Transcript: {transcript}
    Question: {question}
    Check:
    1. Does the question accurately reflect the transcript content?
    2. Is the correct answer consistent with the transcript?
    3. Are the options appropriate and relevant?
    4. Correct_answer is the index starting from 0
    Warning: Only return the json format and nothing more
    Return JSON format:
    {{
        "is_valid": <true/false>,
        "feedback": "<detailed feedback if not valid, empty string if valid>"
    }}
    """,
}

# Function to generate response using Groq
def generate_response(template, transcript, additional_suggestions=""):
    try:
        formatted_content = template["content"].format(transcript=transcript, additional_suggestions=additional_suggestions)
        chat_history = [{"role": template["role"], "content": formatted_content}]
        response = client.chat.completions.create(model="llama3-70b-8192",
                                                 messages=chat_history,
                                                 max_tokens=100,
                                                 temperature=0.7)
        return response.choices[0].message.content
    except KeyError as e:
        return f"KeyError: {str(e)}"

# Function to review questions
def review_question(transcript, question):
    try:
        formatted_content = review_template["content"].format(transcript=transcript, question=question)
        chat_history = [{"role": "system", "content": formatted_content}]
        response = client.chat.completions.create(model="llama3-70b-8192",
                                                 messages=chat_history,
                                                 max_tokens=200,
                                                 temperature=1.0)
        return json.loads(response.choices[0].message.content)
    except json.JSONDecodeError:
        return {"is_valid": False, "feedback": "Invalid review response format"}

# Function to check if the output is valid JSON
def is_valid_json(output):
    try:
        json.loads(output)
        return True
    except json.JSONDecodeError:
        return False

class SupervisorAgent:
    def __init__(self):
        self.agents = {
            "true/false": true_false_template,
            "multiple-choice": mcq_template,
            "multiple-select": msq_template,
        }
        self.max_attempts = 3

    def decide_agent(self, transcript):
        response = generate_response(prompt, transcript)
        try:
            response_json = json.loads(response)
            question_type = response_json["question_type"]
            return self.agents.get(question_type, self.agents["multiple-select"])
        except json.JSONDecodeError:
            return self.agents["multiple-select"]

    def generate_and_review(self, transcript):
        agent = self.decide_agent(transcript)
        attempts = 0
        additional_suggestions = ""

        while attempts < self.max_attempts:
            question = generate_response(agent, transcript, additional_suggestions)
            
            if not is_valid_json(question):
                additional_suggestions = "Previous attempt failed to produce valid JSON. Ensure the response is valid JSON."
                attempts += 1
                continue

            review = review_question(transcript, question)
            print('transcript',transcript)
            print(question)
            print(f"Review: {review}")
            
            if review["is_valid"]:
                return question
            else:
                additional_suggestions = f"Previous question was invalid. Feedback: {review['feedback']}. Please generate a new question addressing this feedback."
                attempts += 1

        # If max attempts reached, return last question or a default
        return question if is_valid_json(question) else '{"error": "Failed to generate valid question after maximum attempts"}'

# Initialize the Supervisor Agent
supervisor = SupervisorAgent()


# Define the transcripts

transcripts = []


# Create a JSON structure to store questions
questions_json = {
    "questions": []
}

# Process each transcript
for i, transcript in tqdm(enumerate(transcripts), total=len(transcripts), desc="Processing Transcripts"):
    response = generate_response(prompt, transcript)
    try:
        response_json = json.loads(response)
        question_type = response_json["question_type"]
    except json.JSONDecodeError:
        question_type = "multiple-select"

    # Generate and review question
    question = supervisor.generate_and_review(transcript)
    
    if is_valid_json(question):
        question_json = json.loads(question)
        if "error" not in question_json:
            questions_json["questions"].append({
                "order": i + 1,
                "type": question_type,
                "question": question_json["question"],
                "options": question_json["options"],
                "correct_answer": question_json["correct_answer"]
            })
    else:
        print(f"Failed to generate a valid question for transcript {i + 1} after review.")

# Print the JSON structure
print(json.dumps(questions_json, indent=4))