from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import re
import urllib.parse
from youtube_transcript_api import YouTubeTranscriptApi
import yt_dlp
import os
import librosa
import soundfile as sf
import speech_recognition as sr
import json
from groq import Groq
from tqdm import tqdm

# FastAPI instance
app = FastAPI()

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:4000"],  # Matches your React app's origin
    allow_credentials=True,
    allow_methods=["*"],  # Allows OPTIONS, POST, etc.
    allow_headers=["*"],  # Allows all headers
)

# Set GROQ_API_KEY in your environment variables
os.environ["GROQ_API_KEY"] = "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"

# Create the Groq client
client = Groq(api_key=os.environ.get("GROQ_API_KEY"))

class VideoURL(BaseModel):
    video_url: str

# --- Transcript Extraction Functions ---
def extract_video_id(video_url):
    parsed_url = urllib.parse.urlparse(video_url)
    query_params = urllib.parse.parse_qs(parsed_url.query)
    if "v" in query_params:
        return query_params["v"][0]
    match = re.search(r"(youtu\.be/|youtube\.com/embed/|youtube\.com/shorts/)([\w-]+)", video_url)
    if match:
        return match.group(2)
    return None

def download_audio(video_url):
    try:
        ydl_opts = {
            'format': 'bestaudio/best',
            'outtmpl': 'audio.%(ext)s',
            'cookiefile': '/content/cookies (2).txt',  # Adjust path if needed
            'postprocessors': [{
                'key': 'FFmpegExtractAudio',
                'preferredcodec': 'mp3',
                'preferredquality': '192',
            }],
        }
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(video_url, download=True)
            return "audio.mp3"
    except Exception as e:
        return f"Error downloading audio: {str(e)}"

def convert_audio_to_wav(audio_file):
    wav_file = "audio.wav"
    try:
        y, sr = librosa.load(audio_file, sr=None)
        sf.write(wav_file, y, sr, subtype='PCM_16')
        return wav_file
    except Exception as e:
        return f"Error converting to WAV: {str(e)}"

def transcribe_audio(audio_path, chunk_length=30):
    recognizer = sr.Recognizer()
    y, sr = librosa.load(audio_path, sr=None)
    total_duration = librosa.get_duration(y=y, sr=sr)
    transcribed_segments = []

    print("Transcribing audio in chunks...")
    for start in range(0, int(total_duration), chunk_length):
        end = min(start + chunk_length, int(total_duration))
        start_sample = int(start * sr)
        end_sample = int(end * sr)
        chunk_data = y[start_sample:end_sample]
        chunk_file = "chunk.wav"
        sf.write(chunk_file, chunk_data, sr, subtype='PCM_16')

        with sr.AudioFile(chunk_file) as source:
            try:
                audio_data = recognizer.record(source)
                text = recognizer.recognize_google(audio_data)
                transcribed_segments.append({"start": start, "end": end, "text": text})
            except sr.UnknownValueError:
                transcribed_segments.append({"start": start, "end": end, "text": "[Unintelligible]"})
            except sr.RequestError as e:
                return f"Error with the speech recognition service: {str(e)}"
        
        os.remove(chunk_file)
    return transcribed_segments

def generate_title_and_description(text):
    if "introduces" in text.lower() or "introduction" in text.lower():
        title = "Introduction"
        description = "Overview of the topic discussed."
    elif "demonstrates" in text.lower() or "setup" in text.lower():
        title = "Setup Demonstration"
        description = "Demonstration of initial setup or configuration."
    elif "graph" in text.lower():
        graph_types = ["Barbell", "Complete", "Cycle", "Ladder", "Path", "Star", "Wheel", "Random"]
        for graph in graph_types:
            if graph.lower() in text.lower():
                if "visualization" in text.lower():
                    title = f"{graph} Graph Visualization"
                    description = f"Visualization of the {graph} graph structure."
                elif "properties" in text.lower():
                    title = f"{graph} Graph Properties"
                    description = f"Explanation of the {graph} graph's properties."
                elif "parameter" in text.lower():
                    title = f"{graph} Graph Parameter Explanation"
                    description = f"Discussion of parameters for the {graph} graph."
                else:
                    title = f"{graph} Graph Introduction"
                    description = f"Introduction to the {graph} graph."
                break
        else:
            title = "Graph Discussion"
            description = "General discussion about graph structures."
    else:
        title = "Segment"
        description = "General segment content."
    return title, description

def get_transcript_unlisted(video_url):
    video_id = extract_video_id(video_url)
    if not video_id:
        return "Invalid YouTube URL."
    
    try:
        transcript = YouTubeTranscriptApi.get_transcript(video_id)
        for segment in transcript:
            segment["end"] = segment["start"] + segment["duration"]
        chunked_transcript = []
        current_chunk_start = 0
        current_chunk_end = 30
        chunked_text = ""
        for segment in transcript:
            segment_start = segment["start"]
            segment_end = segment["end"]
            segment_text = segment["text"]
            if segment_start >= current_chunk_end:
                title, description = generate_title_and_description(chunked_text.strip())
                chunked_transcript.append({
                    "start_time": current_chunk_start,
                    "end_time": current_chunk_end,
                    "text": chunked_text.strip(),
                    "title": title,
                    "video_url": f"https://youtu.be/{video_id}?feature=shared",
                    "description": description
                })
                current_chunk_start = current_chunk_end
                current_chunk_end = current_chunk_start + 30
                chunked_text = segment_text + " "
            else:
                chunked_text += segment_text + " "
            if segment_end > current_chunk_end:
                current_chunk_end = current_chunk_start + 30
        if chunked_text.strip():
            title, description = generate_title_and_description(chunked_text.strip())
            chunked_transcript.append({
                "start_time": current_chunk_start,
                "end_time": current_chunk_end,
                "text": chunked_text.strip(),
                "title": title,
                "video_url": f"https://youtu.be/{video_id}?feature=shared",
                "description": description
            })
        return {"video_id": video_id, "segments": chunked_transcript}
    except Exception as e:
        print("Transcript not available via API, attempting audio transcription...")
        audio_file = download_audio(video_url)
        if "Error" in audio_file:
            return audio_file
        wav_file = convert_audio_to_wav(audio_file)
        if "Error" in wav_file:
            return wav_file
        transcription = transcribe_audio(wav_file)
        os.remove(audio_file)
        os.remove(wav_file)
        segments = []
        for item in transcription:
            title, description = generate_title_and_description(item["text"])
            segments.append({
                "text": item["text"],
                "start_time": item["start"],
                "end_time": item["end"],
                "title": title,
                "video_url": video_url,
                "description": description
            })
        return {"video_id": video_id, "segments": segments}

# --- Question Generation Functions ---
prompt = {"role": "system", "content": """
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
"""}

true_false_template = {"role": "system", "content": """
Generate a true/false question in JSON format based on the transcript: {transcript}
{additional_suggestions}
warning: Only return the json format and nothing more
Format:
{{
    "question": "<question_text>",
    "options": ["True", "False"],
    "correct_answer": <index_of_correct_option>
}}
"""}

mcq_template = {"role": "system", "content": """
Generate a multiple-choice question in JSON format based on the transcript: {transcript}
{additional_suggestions}
warning: Only return the json format and nothing more
Format:
{{
    "question": "<question_text>",
    "options": ["<option1>", "<option2>", "<option3>", "<option4>"],
    "correct_answer": <index_of_correct_option>
}}
"""}

msq_template = {"role": "system", "content": """
Generate a multiple-select question in JSON format based on the transcript: {transcript}
{additional_suggestions}
warning: Only return the json format and nothing more
Format:
{{
    "question": "<question_text>",
    "options": ["<option1>", "<option2>", "<option3>", "<option4>"],
    "correct_answer": [<index_of_correct_option1>, <index_of_correct_option2>]
}}
"""}

review_template = {"role": "system", "content": """
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
"""}

def generate_response(template, transcript, additional_suggestions=""):
    try:
        formatted_content = template["content"].format(transcript=transcript, additional_suggestions=additional_suggestions)
        chat_history = [{"role": template["role"], "content": formatted_content}]
        response = client.chat.completions.create(model="llama3-70b-8192", messages=chat_history, max_tokens=100, temperature=0.7)
        return response.choices[0].message.content
    except KeyError as e:
        return f"KeyError: {str(e)}"

def review_question(transcript, question):
    try:
        formatted_content = review_template["content"].format(transcript=transcript, question=question)
        chat_history = [{"role": "system", "content": formatted_content}]
        response = client.chat.completions.create(model="llama3-70b-8192", messages=chat_history, max_tokens=200, temperature=1.0)
        return json.loads(response.choices[0].message.content)
    except json.JSONDecodeError:
        return {"is_valid": False, "feedback": "Invalid review response format"}

def is_valid_json(output):
    try:
        json.loads(output)
        return True
    except json.JSONDecodeError:
        return False

class SupervisorAgent:
    def __init__(self):
        self.agents = {"true/false": true_false_template, "multiple-choice": mcq_template, "multiple-select": msq_template}
        self.max_attempts = 3

    def decide_agent(self, transcript):
        return self.agents["multiple-choice"]  # Default to multiple-choice for simplicity

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
            if review["is_valid"]:
                return question
            else:
                additional_suggestions = f"Previous question was invalid. Feedback: {review['feedback']}. Please generate a new question addressing this feedback."
                attempts += 1
        return question if is_valid_json(question) else '{"error": "Failed to generate valid question after maximum attempts"}'

supervisor = SupervisorAgent()

def generate_questions_from_transcript(segments):
    questions = []
    for i, segment in tqdm(enumerate(segments), total=len(segments), desc="Generating Questions"):
        transcript = segment["text"]
        question = supervisor.generate_and_review(transcript)
        if is_valid_json(question):
            question_json = json.loads(question)
            if "error" not in question_json:
                questions.append({
                    "question": question_json["question"],
                    "option_1": question_json["options"][0],
                    "option_2": question_json["options"][1],
                    "option_3": question_json["options"][2],
                    "option_4": question_json["options"][3],
                    "correct_answer": str(question_json["correct_answer"]),  # Ensure it's a string
                    "segment": i + 1
                })
    return questions

# --- FastAPI Endpoint ---
@app.post("/get_transcript/")
async def get_transcript(video_url: VideoURL):
    transcript_data = get_transcript_unlisted(video_url.video_url)
    if isinstance(transcript_data, str):
        raise HTTPException(status_code=400, detail=transcript_data)
    
    # Generate questions from the transcript segments
    questions = generate_questions_from_transcript(transcript_data["segments"])
    
    # Structure the response in the desired format
    response = {
        "0": {
            "segments": transcript_data["segments"],
            "questions": questions,
            "video_url": video_url.video_url
        }
    }
    return response

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=5000)