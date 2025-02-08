# app/question_generation/services.py
import asyncio
import uuid
from fastapi import HTTPException
from typing import List, Dict
import google.generativeai as genai
import soundfile as sf
import whisper
from youtube_transcript_api import YouTubeTranscriptApi
from pytubefix import YouTube, Playlist
from pytubefix.cli import on_progress
import ffmpeg
import aiofiles
import aiofiles.os
from .models import VideoSegment, Question, VideoResponse
from .utils import extract_video_id, hide_urls, parse_llama_json
from app.rag import upload_text
import os
from dotenv import load_dotenv
from .prompts import *
import requests

load_dotenv()
os.environ["PATH"] += os.pathsep + os.getenv("FFMPEG_PATH") # Configure FFMPEG locally

print("FFMPEG PATH:", os.getenv("FFMPEG_PATH"))
OLLAMA_API_URL = os.getenv("OLLAMA_API_URL")

class GeminiService:
    def __init__(self):
        self.model = genai.GenerativeModel(model_name="gemini-1.5-flash")

    def set_api_key(self, user_api_key: str):
        genai.configure(api_key=user_api_key)

    async def generate_content(self, prompt: str) -> str:
        """Generate content from Gemini AI with rate limiting"""
        response = await asyncio.to_thread(self.model.generate_content, prompt)
        await asyncio.sleep(10)  # Maintain rate limiting
        return response.text
    
class OllamaService:
    def __init__(self):
        self.model = "deepseek-r1:14b"

    async def generate_content(self, prompt: str) -> str:
        """Generate content from Ollama AI with rate limiting"""
        response = requests.post(OLLAMA_API_URL, json={"model": self.model,
                                                        "prompt": prompt,
                                                        "raw":True,
                                                        "stream": False
                                                        })
        print(response)
        if response.status_code == 200:
            return response.json().get("response", "Error: No response from Ollama.")
        else:
            return f"Error: Ollama API request failed - {response.text}"

class VideoProcessor:
    def __init__(self, ai_service: GeminiService):
        self.whisper_model = whisper.load_model("base")
        self.ai_service = ai_service

    async def process_video(self, url: str, user_api_key: str, timestamps: List[int], segment_wise_q_no: List[int], segment_wise_q_model: List[str]) -> VideoResponse:
        video_id = extract_video_id(url)
        if not video_id:
            raise HTTPException(status_code=400, detail="Invalid YouTube URL")

        transcript = await self.get_raw_transcript(video_id)
        yt = YouTube(url, 'WEB', on_progress_callback=on_progress)
        title = yt.title
        description = hide_urls(yt.description)

        if not transcript:
            segments = await self.process_audio_only(yt, timestamps)
        else:
            segments = self.generate_transcript_segments(transcript, timestamps)

        full_transcript = " ".join([segment.text for segment in segments])
        await upload_text(full_transcript, title)

        questions = await self.generate_questions_for_segments(segments, user_api_key, segment_wise_q_no, segment_wise_q_model)

        for seg in segments:
            seg.title = title
            seg.video_url = url
            seg.description = description

        return VideoResponse(segments=segments, questions=questions)

    async def get_raw_transcript(self, video_id: str) -> List[Dict]:
        try:
            return await asyncio.to_thread(YouTubeTranscriptApi.get_transcript, video_id)
        except Exception:
            return []

    def generate_transcript_segments(self, transcript: List[Dict], timestamps: List[int]) -> List[VideoSegment]:
        duration = max(item["start"] + item["duration"] for item in transcript)
        if not timestamps:
            segment_count = 4
            timestamps = [i * (duration // segment_count) for i in range(0, segment_count)]

        timestamps = sorted(timestamps)
        timestamps.append(duration + 1)

        segments = []
        time_ranges = []
        current_segment = []
        segment_index = 0

        for entry in transcript:
            while (segment_index + 1 < len(timestamps) and 
                   entry["start"] >= timestamps[segment_index + 1]):
                if current_segment:
                    segments.append(" ".join(current_segment))
                    time_ranges.append((timestamps[segment_index], timestamps[segment_index + 1]))
                current_segment = []
                segment_index += 1

            current_segment.append(entry["text"])

        if current_segment:
            segments.append(" ".join(current_segment))
            time_ranges.append((timestamps[segment_index], timestamps[segment_index + 1]))

        return [
            VideoSegment(text=segment, start_time=start, end_time=end)
            for segment, (start, end) in zip(segments, time_ranges)
        ]

    async def process_audio_only(self, yt: YouTube, timestamps: List[int]) -> List[VideoSegment]:
        unique_id = str(uuid.uuid4())[:8]
        m4a_file = f"{unique_id}"
        wav_file = f"{unique_id}.wav"

        ys = yt.streams.get_audio_only()
        ys.download(filename=m4a_file)
        ffmpeg.input(m4a_file).output(wav_file).run()

        audio_data, samplerate = sf.read(wav_file)
        audio_duration = len(audio_data) / samplerate

        if not timestamps:
            timestamps = [i * (audio_duration // 4) for i in range(4)]

        timestamps = sorted(timestamps)
        timestamps.append(audio_duration + 1)

        segments = []
        for i in range(len(timestamps) - 1):
            start_time = timestamps[i]
            end_time = timestamps[i + 1]

            start_sample = int(start_time * samplerate)
            end_sample = int(end_time * samplerate)
            segment_data = audio_data[start_sample:end_sample]

            segment_file = f"{wav_file}_{i}.wav"
            sf.write(segment_file, segment_data, samplerate)

            segment = await self.process_audio_segment(segment_file, start_time, end_time)
            segments.append(segment)
            await aiofiles.os.remove(segment_file)

        await aiofiles.os.remove(wav_file)
        await aiofiles.os.remove(m4a_file)

        return segments

    async def process_audio_segment(self, segment_file: str, start_time: float, end_time: float) -> VideoSegment:
        result = self.whisper_model.transcribe(segment_file)
        return VideoSegment(text=result["text"], start_time=start_time, end_time=end_time)

    async def generate_questions_for_segments(self, segments: List[VideoSegment], user_api_key: str, segment_wise_q_no: List[int], segment_wise_q_model: List[str]) -> List[Question]:
        questions = []
        for i, segment in enumerate(segments):
            questions_response = await self.generate_questions_from_prompt(
                segment.text,
                user_api_key,
                segment_wise_q_no[i],
                segment_wise_q_model[i]
            )
            question_data = parse_llama_json(questions_response)
            print("QUESTION DATAA:\n",question_data)

            if "case_study" in question_data:
                case_study_text = question_data.pop("case_study")
                for question in question_data["questions"]:
                    options = question.pop("options")
                    question_dict = {
                        "question": f"Case study:\n{case_study_text}\nQuestion:\n{question['question']}",
                        "option_1": options[0],
                        "option_2": options[1],
                        "option_3": options[2],
                        "option_4": options[3],
                        "correct_answer": question["correct_answer"],
                        "segment": i + 1
                    }
                    questions.append(Question(**question_dict))
            else:
                for question in question_data["questions"]:
                    options = question.pop("options")
                    question_dict = {
                        "question": question["question"],
                        "option_1": options[0],
                        "option_2": options[1],
                        "option_3": options[2],
                        "option_4": options[3],
                        "correct_answer": question["correct_answer"],
                        "segment": i + 1
                    }
                    questions.append(Question(**question_dict))

        return questions

    async def generate_questions_from_prompt(self, text: str, user_api_key: str, n_questions: int, q_model: str) -> str:
        """Generate questions using AI service"""
        prompt = self._get_prompt(text, n_questions, q_model)
        print("APIIIKEYYYYYYCHECKKKKKKKK: ", user_api_key)
        
        # self.ai_service.set_api_key(os.getenv("API_KEY"))
        return await self.ai_service.generate_content(prompt)

    def _get_prompt(self, text:str, n: int, q_model: str) -> str:
        """Return appropriate prompt template based on question type"""
        if q_model == "case-study":
            task_description = TASK_DESCRIPTION_CASE_STUDY.format(n)
            prompt = task_description + PROMPT_CASE_STUDY.format(text, n)
            return prompt

        task_description = TASK_DESCRIPTION_ANALYTICAL
        prompt = task_description + PROMPT_ANALYTICAL.format(text, n)
        return prompt

class PlaylistProcessor:
    async def get_urls_from_playlist(self, playlist_url: str):
        """Extract video URLs from YouTube playlist"""
        try:
            playlist = await asyncio.to_thread(Playlist, playlist_url)
            return {"video_urls": list(playlist.video_urls)}
        except Exception as e:
            return {"error": str(e), "video_urls": []}