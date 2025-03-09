import json
import os
from groq import Groq

# Set GROQ_API_KEY in your environment variables
# For Colab, you can set it like this:
os.environ["GROQ_API_KEY"] = "api_key_groq"

# Create the Groq client
client = Groq(api_key=os.environ.get("GROQ_API_KEY"))

# Define the prompt
prompt = {
    "role": "system",
    "content": """
    Determine the type of question (true/false, multiple-choice, multiple-select) that best fits the transcript: {transcript}
    Warning: only these 3 types should be the answer true/false, multiple-choice, multiple-select
    Format:
    {{
        "question_type": "<type_of_question>"
    }}
    """,
}

# Define the question generation templates
true_false_template = {
    "role": "system",
    "content": """
    Generate a true/false question in JSON format based on the transcript: {transcript}
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
    warning: Only return the json format and nothing more
    Format:
    {{
        "question": "<question_text>",
        "options": ["<option1>", "<option2>", "<option3>", "<option4>"],
        "correct_answer": [<index_of_correct_option1>, <index_of_correct_option2>]
    }}
    """,
}

# Reviewer Template
review_template = {
    "role": "system",
    "content": "Review the question: {question}. Provide feedback if necessary.",
}

# Function to generate response using Groq
def generate_response(template, transcript):
    try:
        # Correctly format the prompt content
        formatted_content = template["content"].format(transcript=transcript)
        
        # Update chat_history with the formatted content
        chat_history = [{"role": template["role"], "content": formatted_content}]
        
        response = client.chat.completions.create(model="llama3-70b-8192",
                                                  messages=chat_history,
                                                  max_tokens=100,
                                                  temperature=1.2)
        return response.choices[0].message.content
    except KeyError as e:
        return f"KeyError: {str(e)}"

# Function to generate questions using Groq
def generate_question(template, transcript):
    try:
        # Correctly format the prompt content
        formatted_content = template["content"].format(transcript=transcript)
        
        # Update chat_history with the formatted content
        chat_history = [{"role": template["role"], "content": formatted_content}]
        
        response = client.chat.completions.create(model="llama3-70b-8192",
                                                  messages=chat_history,
                                                  max_tokens=100,
                                                  temperature=1.2)
        return response.choices[0].message.content
    except KeyError as e:
        return f"KeyError: {str(e)}"

# Function to review questions using Groq
def review_question(question):
    chat_history = [review_template]
    chat_history[0]["content"] = chat_history[0]["content"].format(question=question)
    response = client.chat.completions.create(model="llama3-70b-8192",
                                              messages=chat_history,
                                              max_tokens=100,
                                              temperature=1.2)
    return response.choices[0].message.content

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
        self.attempts = 0
        self.max_attempts = 2

    def decide_agent(self, transcript):
        # Use LLM to determine question type
        response = generate_response(prompt, transcript)
        try:
            response_json = json.loads(response)
            question_type = response_json["question_type"]
            if question_type in self.agents:
                return self.agents[question_type]
            else:
                # Default to MSQ if question_type is not recognized
                return self.agents["multiple-select"]
        except json.JSONDecodeError:
            # Default to MSQ if LLM fails
            return self.agents["multiple-select"]

    def generate_question(self, transcript):
        agent = self.decide_agent(transcript)
        question = generate_question(agent, transcript)
        
        # Check if the output is valid JSON
        if is_valid_json(question):
            return question
        else:
            # If not valid JSON, try again or switch agents
            self.attempts += 1
            if self.attempts < self.max_attempts:
                # Try again with the same agent
                return self.generate_question(transcript)
            else:
                # Switch to another agent if all attempts fail
                self.attempts = 0
                if agent == self.agents["multiple-select"]:
                    agent = self.agents["multiple-choice"]
                elif agent == self.agents["multiple-choice"]:
                    agent = self.agents["true/false"]
                else:
                    agent = self.agents["multiple-select"]
                return generate_question(agent, transcript)

# Initialize the Supervisor Agent
supervisor = SupervisorAgent()

# Define the transcripts
transcripts = [
    """
    The GDP of New York was approximately $1.6 trillion in 2022. The GDP of California was about $3.6 trillion in the same year. It is true that New York's GDP was higher than California's in 2022.
    """,
    """
    The GDP of New York was approximately $1.6 trillion in 2022. The GDP of California was about $3.6 trillion in the same year. What was the main factor contributing to California's higher GDP?
    """,
    """
    The GDP of New York was approximately $1.6 trillion in 2022. The GDP of California was about $3.6 trillion in the same year. Which of the following factors could influence future business investments in both states?
    """,
]

# Create a JSON structure to store questions
questions_json = {
    "questions": []
}

# Process each transcript
for i, transcript in enumerate(transcripts):
    # Use LLM to determine question type
    response = generate_response(prompt, transcript)
    try:
        response_json = json.loads(response)
        question_type = response_json["question_type"]
    except json.JSONDecodeError:
        # Default to MSQ if LLM fails
        question_type = "multiple-select"
    
    # Generate the question
    agent = supervisor.agents.get(question_type, supervisor.agents["multiple-select"])
    question = generate_question(agent, transcript)
    
    # Check if the output is valid JSON
    if is_valid_json(question):
        question_json = json.loads(question)
        # Append the question to the JSON structure
        questions_json["questions"].append({
            "order": i + 1,
            "type": question_type,
            "question": question_json["question"],
            "options": question_json["options"],
            "correct_answer": question_json["correct_answer"]
        })
    else:
        print(f"Failed to generate a valid question for transcript {i + 1}.")

# Print the JSON structure
print(json.dumps(questions_json, indent=4))
