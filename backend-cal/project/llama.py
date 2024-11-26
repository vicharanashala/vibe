import ollama
import re
import json

def generate_descriptive_from_transcript(filename, model='llama3.2'):
    task_description = """
        You are an AI tasked with generating descriptive questions from a given transcript. 
        Your goal is to:
        1. Identify key concepts, events, or details in the transcript.
        2. Frame questions that require a detailed and thoughtful written response, based on these concepts.
        3. Ensure the questions are clear, specific, and prompt the reader to reflect or explain in-depth about the subject.

        Example output:
        [
            "Describe the main challenges faced during the event mentioned in the transcript.",
            "What are the key factors contributing to the success of the project discussed in the transcript?",
            "Explain the significance of the approach mentioned in addressing the problem outlined in the transcript."
        ]

        Your input will be a transcript, and you will generate 3 descriptive questions based on its content in the format of a JSON list:
        [
            "<question1>", "<question2>", "<question3>"
        ]
    """

    with open(filename, 'r') as file:
        transcript = file.read()

    prompt = task_description + '\n Here is the transcript content: \n' + transcript + 'Generate 3 questions as a JSON list, each question following the specified json format { "question": "<question_text>", "options": ["<option1>", "<option2>", "<option3>", "<option4>"], "correct_answer": <index_of_correct_option> }.'


    response = ollama.generate(model=model, prompt=prompt)
    
    # Regular expression to extract the JSON content
    json_pattern = re.compile(r'\[.*?\]', re.DOTALL)
    json_match = json_pattern.search(response['response'])

    if json_match:
        json_data = json_match.group(0)  # Extract the full JSON block
        parsed_json = json.loads(json_data)  # Parse the JSON
        print(json.dumps(parsed_json, indent=2))  # Pretty-print the parsed JSON
    else:
        print("No JSON found.")

print(generate_descriptive_from_transcript("subtitle.txt"))