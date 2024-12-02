import ollama
import re
import json
import google.generativeai as genai
from pytubefix import YouTube
from pytubefix.cli import on_progress
from pydub import AudioSegment
import whisper
import os
import uuid
from youtube_transcript_api import YouTubeTranscriptApi
from youtube_transcript_api.formatters import TextFormatter

genai.configure(api_key="AIzaSyBrat_wDHdrOGboCJfT-mYhyD_dpqipsbM")

class transcriptAndQueGen:

    def __init__(self):
        self.url = ""
        self.transcript = []
        self.questions = []
        self.timpestamps = []
        self.answers = []
        self.title = ""
        self.transcript = ""
        self.description = ""
        self.duration = ""
        self.model = 'llama3.2'

    def __geminiGenerate(self, prompt):
        model = genai.GenerativeModel('gemini-1.5-flash')
        response = model.generate_content(prompt)
        return response.text

    def __parse_llama_json(self, text):
        # Extract JSON part from the generated text
        start_idx = text.find('[')
        end_idx = text.rfind(']') + 1

        if start_idx == -1 or end_idx == -1:
            raise ValueError("No valid JSON found in the text")

        json_part = text[start_idx:end_idx]

        # Parse the extracted JSON
        try:
            parsed_data = json.loads(json_part)
            return parsed_data
        except json.JSONDecodeError as e:
            raise ValueError(f"Failed to parse JSON: {e}")

    def __generate_questions(self):
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

        prompt = task_description + '\n Here is the transcript content: \n' + str(self.transcript) + 'Generate 3 questions as a JSON list, each question following the specified json format { "question": "<question_text>", "options": ["<option1>", "<option2>", "<option3>", "<option4>"], "correct_answer": <index_of_correct_option> }.'

        response = self.geminiGenerate(prompt)

        return response
    
    def __extract_video_id(self):
        patterns = [
            r"(?:https?://)?(?:www\.)?youtu\.be/([^?&]+)",  # youtu.be short links
            r"(?:https?://)?(?:www\.)?youtube\.com/watch\?v=([^?&]+)",  # youtube.com/watch?v=
            r"(?:https?://)?(?:www\.)?youtube\.com/embed/([^?&]+)",  # youtube.com/embed/
            r"(?:https?://)?(?:www\.)?youtube\.com/live/([^?&]+)",  # youtube.com/live/
            r"(?:https?://)?(?:www\.)?youtube\.com/shorts/([^?&]+)",
        ]

        for pattern in patterns:
            match = re.match(pattern, self.url)
            if match:
                return match.group(1)

        print("Error: Unable to extract video ID.")
        return None

    def __get_raw_transcript(self):
        video_id = self.extract_video_id(self.url)

        if not video_id:
            return None  # Exit if video ID could not be extracted
        try:
            # Fetch transcript
            transcript = YouTubeTranscriptApi.get_transcript(video_id)
            self.transcript = transcript
        except Exception as e:
            return None
    
    def __generate_transcript_segments(self):
        
        self.get_raw_transcript()

        raw_transcript = self.transcript

        # Ensure timestamps are sorted
        self.timestamps = sorted(self.timestamps)
        
        # Add a final timestamp for the end of the video
        last_time = max(item['start'] + item['duration'] for item in raw_transcript)
        self.timestamps.append(last_time + 1)  # Add 1 to ensure all text is included
        
        segments = []
        current_segment = []
        segment_index = 0
        
        for entry in raw_transcript:
            while entry['start'] >= self.timestamps[segment_index + 1]:
                # Finalize the current segment
                segments.append(" ".join(current_segment))
                current_segment = []
                segment_index += 1
            
            # Add the text to the current segment
            current_segment.append(entry['text'])
        
        # Add the last segment
        if current_segment:
            segments.append(" ".join(current_segment))
        
        return segments

    def generate_transcript_from_url(self):
        unique_id = str(uuid.uuid4())[:8]  # Shorten UUID for brevity
        m4a_file = f"{unique_id}"
        wav_file = f"{unique_id}.wav"

        try:
            # Step 1: Download audio from YouTube
            yt = YouTube(self.url, on_progress_callback=on_progress)
            print(f"Downloading audio for video: {yt.title}")
            ys = yt.streams.get_audio_only()
            ys.download(filename=m4a_file)

            # Step 2: Convert .m4a to .wav
            audio = AudioSegment.from_file(f"{m4a_file}.m4a", format="m4a")
            audio.export(wav_file, format="wav")
            print(f"Conversion complete: {wav_file}")

            # Step 3: Handle timestamps if not provided
            if self.timestamps == []:
                duration = len(audio) / 1000  # Convert milliseconds to seconds
                self.timestamps = [i * (duration / 8) * 1000 for i in range(1, 9)]  # Divide into 10 equal parts, convert to ms

            for i in range(len(self.timestamps)):
                start_time = self.timestamps[i]
                end_time = self.timestamps[i + 1] if i + 1 < len(self.timestamps) else len(audio)
                segment = audio[start_time:end_time]

                # Save the segment to a temporary file
                segment_file = f"{unique_id}_segment_{i}.wav"
                segment.export(segment_file, format="wav")
                print(f"Segment {i + 1} saved: {segment_file}")

                self.generate_transcript_from_url()

                if self.transcript == []:
                    # Step 5: Transcribe the segment using Whisper model
                    model = whisper.load_model("base")
                    result = model.transcribe(segment_file)
                    self.transcripts.append(f"{result['text']}")

                # # Step 7: Generate questions from transcript
                llama_output = self.parse_llama_json(self.generate_questions_from_transcript(result['text']))
                for ques in llama_output:
                    ques['segment'] = i
                    self.questions.append(ques)
                    print(f"Generated question: {ques}")

                # Delete the segment file
                os.remove(segment_file)

            # Step 6: Clean up temporary files
            os.remove(f"{m4a_file}.m4a")
            os.remove(wav_file)
            print(f"Temporary files deleted: {m4a_file}.m4a, {wav_file}")
        except Exception as e:
            print(f"Error during transcription: {e}")
            return None
            