from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse
from .schemas import VideoResponse
from app.rag import upload_text
from .services.transcript_servce import get_raw_transcript, generate_transcript_segments
from .services.audio_service import process_audio
from .services.question_service import generate_questions_from_prompt
from .services.url_service import extract_video_id
from .utils.security_utils import hide_urls
from .utils.json_utils import parse_llama_json
import os
from dotenv import load_dotenv
import uuid
import aiofiles
import aiofiles.os
import ffmpeg
import soundfile as sf
from pytubefix import YouTube
from pytubefix.cli import on_progress
from typing import List

app = FastAPI()
load_dotenv()
API_KEY = os.getenv("API_KEY")
os.environ["PATH"] += os.pathsep + os.getenv("FFMPEG_PATH")

async def process_video(url: str, user_api_key: str, timestamps: List[int], segment_wise_q_no: List[int], segment_wise_q_model: List[str]):
    video_id = extract_video_id(url)
    if not video_id:
        raise HTTPException(status_code=400, detail="Invalid YouTube URL")
    
    transcript = await get_raw_transcript(video_id)
    yt = YouTube(url, 'WEB', on_progress_callback=on_progress)
    title = yt.title
    description = hide_urls(yt.description)
    
    if not transcript:
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
            
            segment = await process_audio(segment_file, start_time, end_time)
            segments.append(segment)
            await aiofiles.os.remove(segment_file)
        
        await aiofiles.os.remove(wav_file)
        await aiofiles.os.remove(m4a_file)
    else:
        segments = generate_transcript_segments(transcript, timestamps)
    
    full_transcript = " ".join([segment["text"] for segment in segments])
    await upload_text(full_transcript, title)
    
    questions = []
    for i, segment in enumerate(segments):
        questions_response = await generate_questions_from_prompt(
            segment["text"],
            API_KEY,
            segment_wise_q_no[i],
            segment_wise_q_model[i]
        )
        question_data = parse_llama_json(questions_response)
        
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
    
    for seg in segments:
        seg["title"] = title
        seg["video_url"] = url
        seg["description"] = description
    
    output = VideoResponse(
        segments=segments,
        questions=questions,
    ).model_dump()
    
    return JSONResponse(content=output)