"""
This FastAPI application processes YouTube videos to generate educational content.
It can extract transcripts, segment videos, and automatically generate multiple-choice questions.
The app combines YouTube data extraction, audio processing, and AI-powered question generation.
"""

from fastapi import FastAPI, HTTPException
from .schemas import VideoResponse
from .rag import upload_text
import re
import json
from fastapi.responses import JSONResponse
import google.generativeai as genai
import soundfile as sf
import whisper
import os
import uuid
from youtube_transcript_api import YouTubeTranscriptApi
from pytubefix import YouTube
from pytubefix import Playlist
from pytubefix.cli import on_progress
from typing import List, Dict
import ffmpeg
import asyncio
import aiofiles
import aiofiles.os
from dotenv import load_dotenv

# Initialize FastAPI application and load configuration
app = FastAPI()
load_dotenv()  # Load environment variables from .env file
API_KEY = os.getenv("API_KEY")  # Get API key for Gemini AI model

# Initialize Whisper model for speech-to-text and configure FFMPEG
whisper_model = whisper.load_model("base")
os.environ["PATH"] += os.pathsep + os.getenv("FFMPEG_PATH")

async def generate_from_gemini(prompt: str, user_api_key: str) -> str:
    """
    Interfaces with Google's Gemini AI model to generate content based on prompts.
    Includes rate limiting to prevent API overload.
    
    Parameters:
        prompt: The text input for the AI model
        user_api_key: Authentication key for Gemini API access
    
    Returns:
        The AI-generated response text
    """
    model = genai.GenerativeModel(model_name="gemini-1.5-flash")
    genai.configure(api_key=API_KEY)
    response = await asyncio.to_thread(model.generate_content, prompt)
    await asyncio.sleep(10)  # Rate limiting delay
    return response.text

def hide_urls(text: str) -> str:
    """
    Security function that removes URLs from text to prevent potential security risks.
    Replaces all URLs with a "<url-hidden>" placeholder.
    
    Parameters:
        text: Input text containing URLs
    
    Returns:
        Text with all URLs replaced by placeholders
    """
    url_pattern = (
        r"http[s]?://(?:[a-zA-Z]|[0-9]|[$-_@.&+]|[!*\\(\\),]|"
        r"(?:%[0-9a-fA-F][0-9a-fA-F]))+"
    )
    return re.sub(url_pattern, "<url-hidden>", text)

def parse_llama_json(text: str) -> Dict:
    """
    Processes AI-generated text to extract and validate JSON-formatted question data.
    Provides a fallback structure if parsing fails to ensure API stability.
    
    Parameters:
        text: AI-generated text containing JSON data
    
    Returns:
        Structured dictionary containing questions and answers
    """
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

async def generate_questions_from_prompt(
    text: str, user_api_key: str, n_questions: int, q_model: str
) -> str:
    """
    Core function that generates educational multiple-choice questions from video content.
    Supports both analytical and case-study question formats.
    
    Parameters:
        text: Transcript text to generate questions from
        user_api_key: API key for AI model access
        n_questions: Number of questions to generate
        q_model: Question type ("case-study" or "analytical")
    
    Returns:
        JSON-formatted string containing generated questions
    """

    n = n_questions  # Number of questions to generate

    # Define templates for different question types
    task_description_analytical = """
        You are an advanced AI designed to generate challenging multiple-choice questions (MCQs) for university-level exams.
        Your goal is to:
        1. Identify core concepts, theories, or key ideas in the transcript.
        2. Frame questions that require analytical thinking, application of knowledge, or evaluation.
        3. Use domain-specific language and include plausible distractors that reflect common misconceptions or similar concepts.
        4. Include 4 answer options for each question, specifying the correct answer index.
        5. Format your response as a JSON list where each entry follows the structure:
        { "question": "<question_text>", "options": ["<option1>", "<option2>", "<option3>", "<option4>"], "correct_answer": <index_of_correct_option> }
        Types of questions:
        1. Analytical: Require reasoning or critical thinking.
        2. Application-Based: Apply concepts to new scenarios or problems.
        3. Evaluation: Require judgment or interpretation.
        Example output:
        {
            "questions" : [
                {
                    "question": "Why is photosynthesis critical for the survival of most ecosystems?",
                    "options": ["It is the only source of carbon dioxide.", "It provides oxygen for respiration.", "It creates heat energy for plants.", "It prevents water loss in leaves."],
                    "correct_answer": 1
                },
                {
                    "question": "What would likely occur if Earth's axial tilt increased?",
                    "options": ["Stronger seasonal temperature differences.", "Fewer hours of daylight at the poles.", "Reduced intensity of sunlight near the equator.", "More uniform global climates year-round."],
                    "correct_answer": 0
                },
                {
                    "question": "How does the principle of competitive exclusion influence species diversity within an ecosystem?",
                    "options": ["It causes a uniform distribution of species.", "It eliminates all predator-prey interactions.", "It leads to resource partitioning among species.", "It prevents mutualistic relationships."],
                    "correct_answer": 2
                }
            ]
        }
    """
    
    task_description_case_study = f"""
            You are an advanced AI tasked with generating university-level case-study-based multiple-choice questions (MCQs) from a given transcript.
            Your goal is to:
            1. Create a unique case study or scenario inspired by the transcript. The case study should:
                - Be an example or situation that applies key ideas, concepts, or theories from the transcript.
                - Go beyond summarizing the transcript by crafting a practical or hypothetical context.
            2. Frame {n}""" + """ questions that require analytical thinking, problem-solving, or evaluation based on the case study.
            3. Provide 4 answer options for each question, ensuring one is correct and the others are plausible but incorrect.
            4. Specify the index (0-based) of the correct answer for each question.
            5. Format your response as a JSON object where the case study is provided along with the questions. Use the structure:
            {
                "case_study": "<case_study_paragraph>",
                "questions": [
                    { 
                        "question": "<question_text>", 
                        "options": ["<option1>", "<option2>", "<option3>", "<option4>"], 
                        "correct_answer": <index_of_correct_option> 
                    },
                    ...
                ]
            }
            Types of questions to generate:
            1. Analytical: Require reasoning or critical thinking about the case study.
            2. Application-Based: Apply concepts to solve problems or make decisions in the context of the case study.
            3. Evaluation: Require judgment, interpretation, or assessment of the situation presented.
            Example output:
            {
                "case_study": "A new factory has been set up near a river, causing concerns about pollution. The factory produces textile dyes, which may contaminate water sources. The local government needs to balance economic benefits with environmental risks.",
                "questions": [
                    {
                        "question": "What is the most likely environmental impact of the factory's operations?",
                        "options": ["Decreased oxygen levels in the river.", "Improved water clarity.", "Increase in fish population.", "Reduction in soil erosion."],
                        "correct_answer": 0
                    },
                    {
                        "question": "Which of the following actions would best mitigate the environmental risks posed by the factory?",
                        "options": ["Enforcing stricter emission controls.", "Encouraging higher production rates.", "Diverting the river away from the factory.", "Promoting the use of synthetic materials."],
                        "correct_answer": 0
                    },
                    {
                        "question": "How might local residents be affected if pollution levels rise?",
                        "options": ["Improved access to clean drinking water.", "Increased health issues such as skin diseases.", "Higher crop yields in nearby farms.", "Reduced water temperatures in the river."],
                        "correct_answer": 1
                    }
                ]
            }
        """
    
    # Select appropriate prompt template and generate questions
    prompt_1 = task_description_analytical + '\n Here is the transcript content: \n' + str(text) + f'\nGenerate {n} questions' + ' as a JSON object in the following format: \n{ \n    "questions": [ \n        { \n            "question": "<question_text>", \n            "options": ["<option1>", "<option2>", "<option3>", "<option4>"], \n            "correct_answer": <index_of_correct_option> \n        }, \n        { \n            "question": "<question_text>", \n            "options": ["<option1>", "<option2>", "<option3>", "<option4>"], \n            "correct_answer": <index_of_correct_option> \n        }, \n        { \n            "question": "<question_text>", \n            "options": ["<option1>", "<option2>", "<option3>", "<option4>"], \n            "correct_answer": <index_of_correct_option> \n        } \n    ] \n}.'

    prompt_2 = task_description_case_study + '\n Here is the transcript content: \n' + str(text) + f'\nGenerate {n} questions' + ' as a JSON object in the following format: \n{ \n    "case_study": "<case_study_text>", \n    "questions": [ \n        { \n            "question": "<question_text>", \n            "options": ["<option1>", "<option2>", "<option3>", "<option4>"], \n            "correct_answer": <index_of_correct_option> \n        }, \n        { \n            "question": "<question_text>", \n            "options": ["<option1>", "<option2>", "<option3>", "<option4>"], \n            "correct_answer": <index_of_correct_option> \n        }, \n        { \n            "question": "<question_text>", \n            "options": ["<option1>", "<option2>", "<option3>", "<option4>"], \n            "correct_answer": <index_of_correct_option> \n        } \n    ] \n}.'

    prompt = prompt_2 if q_model == "case-study" else prompt_1
    response = await generate_from_gemini(prompt, user_api_key)
    return response

def extract_video_id(url: str) -> str:
    """
    Extracts YouTube video ID from various URL formats (regular, short, live, etc.).
    
    Parameters:
        url: YouTube video URL in any standard format
    
    Returns:
        Video ID string or None if no valid ID found
    """
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

async def get_urls_from_playlist(playlist_url: str):
    """
    Extracts all video URLs from a YouTube playlist.
    
    Parameters:
        playlist_url: URL of the YouTube playlist
    
    Returns:
        Dictionary containing list of video URLs or error details
    """
    try:
        playlist = await asyncio.to_thread(Playlist, playlist_url)
        video_urls = await asyncio.to_thread(lambda: list(playlist.video_urls))
        return {"video_urls": video_urls}
    except Exception as e:
        return {"error": str(e), "video_urls": []}

async def get_raw_transcript(video_id: str) -> List[Dict]:
    """
    Fetches the transcript/subtitles for a YouTube video if available.
    
    Parameters:
        video_id: YouTube video identifier
    
    Returns:
        List of transcript segments with timing information
    """
    try:
        transcript = await asyncio.to_thread(YouTubeTranscriptApi.get_transcript, video_id)
        return transcript
    except Exception:
        return []

def generate_transcript_segments(transcript: List[Dict], timestamps: List[int]) -> List[Dict]:
    """
    Divides a video transcript into segments based on specified timestamps.
    Used for breaking down long videos into manageable chunks.
    
    Parameters:
        transcript: Full video transcript
        timestamps: Points at which to split the transcript
    
    Returns:
        List of transcript segments with timing information
    """
    # Calculate video duration and create default segments if no timestamps provided
    duration = max(item["start"] + item["duration"] for item in transcript)
    if not timestamps:
        segment_count = 4
        timestamps = [i * (duration // segment_count) for i in range(0, segment_count)]
    
    timestamps = sorted(timestamps)
    timestamps.append(duration + 1)
    
    # Process transcript into segments
    segments = []
    time_ranges = []
    current_segment = []
    segment_index = 0
    
    for entry in transcript:
        while (segment_index + 1 < len(timestamps) and 
               entry["start"] >= timestamps[segment_index + 1]):
            if current_segment:
                segments.append(" ".join(current_segment))
                time_ranges.append((timestamps[segment_index], 
                                  timestamps[segment_index + 1]))
            current_segment = []
            segment_index += 1
        
        current_segment.append(entry["text"])
    
    if current_segment:
        segments.append(" ".join(current_segment))
        time_ranges.append((timestamps[segment_index], timestamps[segment_index + 1]))
    
    return [
        {"text": segment, "start_time": start, "end_time": end}
        for segment, (start, end) in zip(segments, time_ranges)
    ]

async def process_audio(segment_file: str, start_time: float, end_time: float) -> Dict:
    """
    Processes an audio segment using Whisper model for speech-to-text conversion.
    Used when no transcript is available for a video.
    
    Parameters:
        segment_file: Path to audio file segment
        start_time: Segment start time
        end_time: Segment end time
    
    Returns:
        Dictionary containing transcribed text and timing information
    """
    result = await asyncio.to_thread(whisper_model.transcribe, segment_file)
    return {
        "text": result["text"],
        "start_time": start_time,
        "end_time": end_time,
    }

async def process_video(url, user_api_key, timestamps, segment_wise_q_no, segment_wise_q_model):
    """
    Main video processing pipeline that coordinates the entire application flow.
    Handles video download, transcription, segmentation, and question generation.
    
    Parameters:
        url: YouTube video URL
        user_api_key: API key for AI services
        timestamps: Points at which to segment the video
        segment_wise_q_no: Number of questions to generate per segment
        segment_wise_q_model: Type of questions to generate per segment
    
    Returns:
        JSONResponse containing processed video data and generated questions
    
    Raises:
        HTTPException: For invalid URLs or processing errors
    """
    # Validate and extract video information
    video_id = extract_video_id(url)
    if not video_id:
        raise HTTPException(status_code=400, detail="Invalid YouTube URL")
    
    transcript = await get_raw_transcript(video_id)
    yt = YouTube(url, 'WEB', on_progress_callback=on_progress)
    title = yt.title
    description = hide_urls(yt.description)
    
    if not transcript:
        # Handle videos without available transcripts
        # Download audio, convert to WAV, segment, and transcribe
        unique_id = str(uuid.uuid4())[:8]
        m4a_file = f"{unique_id}"
        wav_file = f"{unique_id}.wav"
        
        # Download and convert audio
        ys = yt.streams.get_audio_only()
        ys.download(filename=m4a_file)
        ffmpeg.input(m4a_file).output(wav_file).run()
        
        # Process audio segments
        audio_data, samplerate = sf.read(wav_file)
        audio_duration = len(audio_data) / samplerate
        
        if not timestamps:
            timestamps = [i * (audio_duration // 4) for i in range(4)]
        
        timestamps = sorted(timestamps)
        timestamps.append(audio_duration + 1)
        
        # Process each segment
        segments = []
        for i in range(len(timestamps) - 1):
            start_time = timestamps[i]
            end_time = timestamps[i + 1]
            
            # Extract and save segment
            start_sample = int(start_time * samplerate)
            end_sample = int(end_time * samplerate)
            segment_data = audio_data[start_sample:end_sample]
            
            segment_file = f"{wav_file}_{i}.wav"
            sf.write(segment_file, segment_data, samplerate)
            
            # Process segment
            segment = await process_audio(segment_file, start_time, end_time)
            segments.append(segment)
            await aiofiles.os.remove(segment_file)
        
        # Cleanup temporary files
        await aiofiles.os.remove(wav_file)
        await aiofiles.os.remove(m4a_file)
    else:
        # Process videos with available transcripts
        segments = generate_transcript_segments(transcript, timestamps)
    
    # Upload full transcript for future reference
    full_transcript = " ".join([segment["text"] for segment in segments])
    await upload_text(full_transcript, title)
    
    # Generate questions for each segment
    questions = []
    for i, segment in enumerate(segments):
        questions_response = await generate_questions_from_prompt(
            segment["text"],
            user_api_key,
            segment_wise_q_no[i],
            segment_wise_q_model[i]
        )
        question_data = parse_llama_json(questions_response)
        
        # Process and format questions
        if "case_study" in question_data:
            case_study_text = question_data.pop("case_study")
            for question in question_data["questions"]:
                options = question.pop("options")
                for j, option in enumerate(options, 1):
                    question[f"option_{j}"] = option
                question["question"] = f"Case study:\n{case_study_text}\nQuestion:\n{question['question']}"
                question["segment"] = i + 1
                questions.append(question)
        else:
            for question in question_data["questions"]:
                options = question.pop("options")
                for j, option in enumerate(options, 1):
                    question[f"option_{j}"] = option
                question["segment"] = i + 1
                questions.append(question)
    
    # Add metadata to segments
    for seg in segments:
        seg["title"] = title
        seg["video_url"] = url
        seg["description"] = description
    
    # Return processed data
    output = VideoResponse(
        segments=segments,
        questions=questions,
    ).model_dump()
    
    return JSONResponse(content=output)