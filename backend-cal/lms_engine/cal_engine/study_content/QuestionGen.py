#pip install pytubefix openai-whisper ffmpeg-python youtube_transcript_api
#import ollama
import re
import json
import google.generativeai as genai
from pytubefix import YouTube
from pytubefix.cli import on_progress
import ffmpeg
import whisper
import os
import uuid
import time
from youtube_transcript_api import YouTubeTranscriptApi
from youtube_transcript_api.formatters import TextFormatter
from cal_engine.assessment.models import Question, Assessment, ChoiceSolution
from cal_engine.course.models import Section
from django.shortcuts import get_object_or_404

genai.configure(api_key="AIzaSyBOe0ZxXCHfjX2dzaVPkP67tqjCcspsvs0")

class transcriptAndQueGen:

    def __init__(self, url: str, section_id: int, sequence: int) -> None:

        self.url = url
        self.section_id = section_id
        self.sequence = sequence

        self.title = ""
        self.transcripts = []
        self.questions = []
        self.timestamps = []
        self.answers = []
        self.transcript = ""
        self.description = ""
        self.duration = ""
        self.model = 'llama3.2'
        self.segmentsCount = 4
        self.video_id = None


    # Calling on Gemini API
    def generateFromGemini(self, prompt):
        model = genai.GenerativeModel('gemini-1.5-flash')
        response = model.generate_content(prompt)
        time.sleep(10)
        return response.text

    def hide_urls(self, text):
        url_pattern = r"http[s]?://(?:[a-zA-Z]|[0-9]|[$-_@.&+]|[!*\\(\\),]|(?:%[0-9a-fA-F][0-9a-fA-F]))+"  # Regex to match URLs
        return re.sub(url_pattern, "<url-hidden>", text)

    # Get data from LLM and format it in favourable json format
    def parseLlamaJson(self, text):
        # Extract JSON part from the generated text
        start_idx = text.find('[')
        end_idx = text.rfind(']') + 1

        if start_idx == -1 or end_idx == -1:
            raise ValueError("No valid JSON found in the text")

        json_part = text[start_idx:end_idx]

        # Parse the extracted JSON
        try:
            parsed_data = json.loads(json_part)
            print(parsed_data)
            return parsed_data
        except json.JSONDecodeError as e:
            raise ValueError(f"Failed to parse JSON: {e}")
    

    # Format the prompt
    def generateQuestionsFromPrompt(self, text):
        
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

        prompt = task_description + '\n Here is the transcript content: \n' + str(text) + 'Generate 3 questions as a JSON list, each question following the specified json format { "question": "<question_text>", "options": ["<option1>", "<option2>", "<option3>", "<option4>"], "correct_answer": <index_of_correct_option> }.'

        response = self.generateFromGemini(prompt)

        return response
    

    # Extract video ID from the URL
    def extractVideoId(self):
        # Extract the video ID from the URL
        from .models import Video, VideoSegment
        yt = YouTube(self.url, on_progress_callback=on_progress)
        self.title = self.hide_urls(yt.title)
        self.description = self.hide_urls(yt.description)

        patterns = [
            r"(?:https?://)?(?:www\.)?youtu\.be/([^?&]+)",  # youtu.be short links
            r"(?:https?://)?(?:www\.)?youtube\.com/watch\?v=([^?&]+)",  # youtube.com/watch?v=
            r"(?:https?://)?(?:www\.)?youtube\.com/embed/([^?&]+)",  # youtube.com/embed/
            r"(?:https?://)?(?:www\.)?youtube\.com/shorts/([^?&]+)",  # youtube.com/shorts/
            r"(?:https?://)?(?:www\.)?youtube\.com/live/([^?&]+)",  # youtube.com/live/
        ]

        for pattern in patterns:
            match = re.match(pattern, self.url)
            if match:
                self.video_id = match.group(1)
                # section_instance = get_object_or_404(Section, pk=self.section_id)
                # vid = Video.objects.create(
                #     link=self.url,
                #     section=section_instance,
                #     title=self.title,
                #     description=self.description,
                #     youtube_id=self.video_id,
                #     sequence=self.sequence
                #     )
                return self.video_id

        print("Error: Unable to extract video ID.")
        return None

    def create_video(url, section_id, sequence):
        from .models import Video, VideoSegment
        tqg = transcriptAndQueGen(url, section_id, sequence)
        video_id = tqg.extractVideoId()
        section_instance = get_object_or_404(Section, pk=section_id)
        Video.objects.create(
            link=url,
            section=section_instance,
            title=tqg.title,
            description=tqg.description,
            youtube_id=video_id,
            sequence=sequence
        )

    # Get raw transcript from YouTube
    def getRawTranscript(self):
        video_id = self.extractVideoId()
        if not video_id:
            return None
        try:
            transcript = YouTubeTranscriptApi.get_transcript(video_id)
            self.transcript = transcript
        except Exception as e:
            return None


    # Generate transcript segments
    def generate_transcript_segments(self):
        self.getRawTranscript()
        raw_transcript = self.transcript

        if self.timestamps == []:
            # Get video duration
            duration = max(item['start'] + item['duration'] for item in raw_transcript)
            self.timestamps = [i * (duration // self.segmentsCount) for i in range(0, self.segmentsCount)]

        # Ensure timestamps are sorted
        self.timestamps = sorted(self.timestamps)

        # Add a final timestamp for the end of the video
        last_time = max(item['start'] + item['duration'] for item in raw_transcript)
        self.timestamps.append(last_time + 1)  # Add 1 to ensure all text is included

        segments = []
        time_ranges = []
        current_segment = []
        segment_index = 0

        for entry in raw_transcript:
            while segment_index + 1 < len(self.timestamps) and entry['start'] >= self.timestamps[segment_index + 1]:
                # Finalize the current segment
                if current_segment:
                    segments.append(" ".join(current_segment))
                    time_ranges.append((self.timestamps[segment_index], self.timestamps[segment_index + 1]))
                current_segment = []
                segment_index += 1

            # Add the text to the current segment
            current_segment.append(entry['text'])

        # Add the last segment
        if current_segment:
            segments.append(" ".join(current_segment))
            time_ranges.append((self.timestamps[segment_index], self.timestamps[segment_index + 1]))

        # Return segments along with their start and end times
        return [{"text": segment, "start_time": start, "end_time": end}
                for segment, (start, end) in zip(segments, time_ranges)]

    # Generate questions from the video
    def generateQuestions(self):
        unique_id = str(uuid.uuid4())[:8]  # Shorten UUID for brevity
        m4a_file = f"{unique_id}"
        wav_file = f"{unique_id}.wav"
        segs = self.generate_transcript_segments()
        from .models import Video, VideoSegment

        # segs = []
        vid = Video.objects.filter(youtube_id=self.video_id).first()

        if segs == []:
            vid = Video.objects.filter(youtube_id=self.video_id).first()
            print(vid.id)
            try:
                # Step 1: Download audio from YouTube
                yt = YouTube(self.url, on_progress_callback=on_progress)
                print(f"Downloading audio for video: {yt.title}")
                ys = yt.streams.get_audio_only()
                ys.download(filename=m4a_file)

                # Step 2: Convert .m4a to .wav
                ffmpeg.input(m4a_file).output(wav_file).run(overwrite_output=True)
                print(f"Conversion complete: {wav_file}")

                # Step 3: Handle timestamps if not provided
                if self.timestamps == []:
                    # Get the duration of the audio in seconds
                    probe = ffmpeg.probe(wav_file)
                    duration_seconds = float(probe['format']['duration'])
                    duration_ms = int(duration_seconds * 1000)

                    # Generate timestamps at 5-minute intervals
                    segment_duration = 5
                    segment_ms = segment_duration * 60 * 1000  # Convert minutes to milliseconds
                    timestamps = [i * segment_ms for i in range(duration_ms // segment_ms + 1)]  # Divide into 4 equal parts, convert to secs

                    transcripts = []
                     # Load Whisper model once
                    model = whisper.load_model("base")

                    # Save the segment to a temporary file
                    for i in range(len(timestamps) - 1):  # Ensure no out-of-range error
                        start_time = timestamps[i] / 1000  # Convert to seconds for FFmpeg
                        end_time = timestamps[i + 1] / 1000  # Convert to seconds for FFmpeg

                        segment_file = f"{unique_id}_segment_{i}.wav"

                    ffmpeg.input(wav_file, ss=start_time, to=end_time).output(segment_file).run(overwrite_output=True)
                    print(f"Segment {i + 1} saved: {segment_file}")

                    # Transcribe the segment using Whisper model
                    result = model.transcribe(segment_file)
                    segment_transcript = result['text']

                    # Apply URL hiding to transcript
                    segment_transcript = self.hide_urls(segment_transcript)

                    transcripts.append(f"---Segment {i + 1} Transcript:\n{segment_transcript}\n")

                    # Delete the segment file after transcription
                    os.remove(segment_file)

                # Step 6: Clean up temporary files
                os.remove(f"{m4a_file}.m4a")
                os.remove(wav_file)
                print(f"Temporary files deleted: {m4a_file}.m4a, {wav_file}")
            except Exception as e:
                print(f"Error during transcription: {e}")
                return None
        else:
            sec = Section.objects.get(pk=self.section_id)
            course = sec.module.course
            for k, segment in enumerate(segs):
                llama_output = self.parseLlamaJson(self.generateQuestionsFromPrompt(segment["text"]))

                for i in range(len(llama_output)):
                    llama_output[i]['segment'] = k
                    self.questions.append(llama_output[i])
                
                assess_title = f"{self.video_id}_{k}"
                assessment = Assessment.objects.create(
                    title = assess_title,
                    course = course,
                    type = 'video'
                )
                for question_data in llama_output:
                    question = Question.objects.create(
                        text=question_data["question"],
                        type='MCQ'
                    )
                    question.assessments.add(assessment)
                    for i, choice_data in enumerate(question_data["options"]): 
                        ChoiceSolution.objects.create(
                            question=question,
                            format='text',
                            value=choice_data,
                            is_correct=i==question_data["correct_answer"],
                        )
                VideoSegment.objects.create(
                    video=vid,
                    title=assess_title,
                    start_time=segment["start_time"],
                    transcript=segment["text"],
                    assessment=assessment
                )
        
        return self.questions


