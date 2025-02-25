# LLM Backend API Documentation

This document provides a comprehensive overview of the LLM Backend API, designed for generating questions from YouTube videos and playlists, and providing AI-powered support for student doubts. It covers the entire workflow, from user input on the frontend to data processing on the backend, including question generation and knowledge retrieval for RAG, and eventual data upload to the LMS (Learning Management System). This documentation aims to equip developers with the necessary knowledge to maintain, troubleshoot, and extend the functionality of the application.

## 1. Basic Workflow/Overview

The application enables two primary functionalities: automatic question generation from YouTube videos and playlists, and AI-powered assistance for students to answer doubts related to the video content. The combined workflow can be summarized as follows:

1.  **User Input (Frontend):**
    *   The user accesses the frontend web interface (served from `app/templates/index.html`).
    *   The user submits a YouTube URL (either a single video or a playlist) into the "Enter YouTube playlist or video URL" field.
    *   The user selects a Course, Module, and Section from the LMS via hierarchical dropdown menus. These dropdowns are populated dynamically by fetching data from the LMS API using `config.LMS_GET_URL`.
    *   The user provides a default number of segments per video and a default number of questions per segment. These values are entered into the "Default Number of Segments" and "Default Questions per Segment" fields respectively.
    *   The user selects the AI model to use (Gemini or Ollama) via the "Choose Model" dropdown.
        *   If Gemini is selected, the user must also provide their Gemini API key in the "Gemini API Key" field.
    *   The user clicks the "Submit" button next to the URL field.

2.  **Playlist URL Processing (Frontend & Backend):**
    *   **If a playlist URL is submitted:**
        *   The frontend makes an asynchronous POST request to the backend endpoint `/questions/get_urls` (defined in `app/routers/question.py`). The request body contains a JSON object with the `url` field set to the playlist URL.
        *   The backend processes the request using the `get_urls` function in `app/services.py`. This function utilizes the `PlaylistProcessor` class from `app/question_generation/services.py`. The `get_urls_from_playlist` method of `PlaylistProcessor` uses the `pytubefix` library to extract all video URLs from the playlist. This operation is executed in a separate thread using `asyncio.to_thread` to prevent blocking the main event loop.
        *   The backend returns a JSON response containing a list of video URLs (`{"video_urls": [...]}`).
    *   **If a single video URL is submitted:**
        *   The frontend treats the single URL as a playlist containing only one video. The `videoUrls` array is initialized with just this single URL.

3.  **Video Display and Customization (Frontend):**
    *   The frontend displays the video(s) in boxes within the `<div id="videos-container"></div>` element. Each video is represented by a `div` with the class `video-block`.
    *   For each video, the user can customize the following details:
        *   **Number of Segments:** The user can specify the number of segments to divide the video into using the `<input type="number" id="num-segments">` field within the `<form id="video-form">` element.
        *   **Segment Details:** For each segment, the user can customize:
            *   **Timestamp:** The start time of the segment (in HH:MM:SS format).
            *   **Number of Questions:** The number of questions to generate for the segment.
            *   **Type of Questions:** The type of questions to generate (Analytical or Case Study).
    *   The video duration is automatically fetched using the YouTube IFrame API and stored in the `videoDurations` object.

4.  **AI Model Selection and API Key (Frontend):**
    *   The user selects the AI model to use for question generation from the `<select id="model-selection">` dropdown. Options are Gemini API and Ollama API.
    *   If Gemini API is selected, the user must provide a valid Gemini API key in the `<input type="text" id="user-api-key">` field. This field is displayed conditionally using JavaScript based on the selected model. The API key is validated as `required` only when Gemini is selected.
    *   If Ollama API is selected, the API key field is hidden, and a default API key ("ollama1064") is used as a placeholder.

5.  **Data Processing and Batching (Frontend):**
    *   Before sending the data to the backend, the frontend divides the videos into batches to avoid hitting the rate limits of the Gemini 1.5 Flash API.
    *   The `createBatches` function in the Javascript code calculates the batches such that each batch contains a maximum of 15 segments. This helps prevent rate limiting issues when using the Gemini API.

6.  **Question Generation and Transcript Upload (Frontend & Backend):**
    *   The frontend makes an asynchronous POST request to the backend endpoint `/questions/process_video` (defined in `app/routers/question.py`) for each batch of videos.
    *   The request body contains a JSON object with the following fields:
        *   `url`: The URL of the YouTube video.
        *   `user_api_key`: The user's API key (or "ollama1064" if Ollama is selected).
        *   `timestamps`: A list of timestamps (in seconds) defining the start times of each segment.
        *   `segment_wise_q_no`: A list of the number of questions to generate for each segment.
        *   `segment_wise_q_model`: A list of the question types (Analytical or Case Study) for each segment.
    *   The backend processes the video to generate questions. The full video transcript is also extracted and uploaded to the vector database for RAG (Retrieval Augmented Generation).

7.  **Backend Processing for Question Generation and RAG (app/services.py & app/question\_generation/services.py & app/rag.py):**
    *   The backend processes the request using the `process_process_video` function in `app/services.py`. This function orchestrates both the question generation process and the transcript upload for RAG.
    *   **AI Service Initialization:**
        *   Based on the `user_api_key`, either the `GeminiService` or `OllamaService` is instantiated.
        *   If the `user_api_key` is "ollama1064", the `OllamaService` is used. Otherwise, the `GeminiService` is used.
        *   If using `GeminiService`, the API key is set using `ai_service.set_api_key(os.getenv("API_KEY"))`. Note: Currently the API key is taken from environment variable, not user input.
    *   **Video Processing:**
        *   A `VideoProcessor` object is instantiated, passing in the chosen AI service (`GeminiService` or `OllamaService`).
        *   The `process_video` method of the `VideoProcessor` class in `app/question_generation/services.py` is called. This method performs the following steps:
            *   **Extract Video ID:** The `extract_video_id` function from `app/question_generation/utils.py` extracts the video ID from the YouTube URL using regular expressions.
            *   **Get Transcript:** The `get_raw_transcript` method attempts to retrieve the video transcript from the YouTube Transcript API. If a transcript is available, it's returned as a list of dictionaries. If not, an empty list is returned.
            *   **Create YouTube Object:** A `YouTube` object is created from the `pytubefix` library, using the video URL and the `'WEB'` parameter to bypass bot detection measures.
            *   **Get Video Metadata:** The video title and description are retrieved from the `YouTube` object. The `hide_urls` function from `app/question_generation/utils.py` is used to remove URLs from the description, replacing them with `<url_hidden>`.
            *   **Segment Generation:**
                *   **If a transcript is available (transcript list is not empty):** The `generate_transcript_segments` method is called to divide the video into segments based on the provided timestamps and the transcript.
                *   **If a transcript is NOT available (transcript list is empty):** The `process_audio_only` method is called to download the audio from the video and transcribe it using the Whisper model. This method transcribes the audio by first downloading the audio, converting it to the correct format, and then using whisper.
            *   **Full Transcript Generation and RAG Upload:** The transcript from the video is aggregated and uploaded to the vector database for use with RAG for student doubt answering using the `upload_text` function from `app/rag.py`. This function is crucial for providing context to the RAG system. The title of the video is passed as the document name, and the full_transcript is the content.
            *   **Question Generation:** The `generate_questions_for_segments` method is called to generate questions for each segment using the AI service.
            *   **Response Construction:** A `VideoResponse` object (defined in `app/question_generation/models.py`) is created, containing the list of `VideoSegment` objects and the list of `Question` objects. The `VideoResponse` object is returned to the frontend.

8.  **Transcript-based Segment Generation (`generate_transcript_segments`):**
    *   This function is called when a transcript is successfully retrieved from the YouTube Transcript API. It takes the raw transcript (a list of dictionaries with `text`, `start`, and `duration` keys) and a list of timestamps as input.
    *   The function determines the video duration by finding the maximum timestamp from the transcript data. If no timestamps are provided by the user, it defaults to dividing the video into 4 equal segments.
    *   The timestamps are sorted and the video's final end time is appended (duration + 1).
    *   The core logic iterates through the raw transcript entries. For each entry, it checks if the entry's start time exceeds the next defined timestamp boundary. If it does, it signifies the end of a segment:
        *   The accumulated text for the current segment is joined into a single string.
        *   The start and end times of the segment are recorded.
        *   A new `VideoSegment` object is created and added to the list of segments.
        *   The accumulated text for the current segment is cleared.
    *   If, after iterating through all transcript entries, there is any remaining accumulated text, a final `VideoSegment` object is created for the last segment.
    *   The function returns a list of `VideoSegment` objects, each representing a segment of the video with its text, start time, and end time.

9.  **Audio-Only Segment Generation (`process_audio_only`):**
    *   This function is called when a transcript is not available. It downloads the audio, divides the audio into segments based on the user-provided timestamps, and transcribes each segment using the Whisper model.
    *   A unique filename is generated using UUID.
    *   The function retrieves the audio stream from the `YouTube` object.
    *   `ffmpeg` is used to convert the downloaded audio to the correct format (`.wav`). The path to `ffmpeg` is configured using the `FFMPEG_PATH` environment variable.
    *   The `soundfile` library is used to read the audio data and sample rate from the `.wav` file.
    *   The timestamps are sorted, and segments are created by splitting the audio data based on the timestamps.
    *   Each segment is transcribed using the `whisper` model.
    *   The function returns a list of `VideoSegment` objects, each representing a segment of the video with its transcribed text, start time, and end time.
    *   It also cleans up the temporary audio files that were created.

10. **Question Generation (`generate_questions_for_segments`):**
    *   This function iterates through the `VideoSegment` objects and generates questions for each segment using the selected AI service (Gemini or Ollama).
    *   For each segment, the `generate_questions_from_prompt` method is called.
    *   The `_get_prompt` method constructs a prompt based on the segment text, the number of questions requested, and the selected question model (Analytical or Case Study). It utilizes different prompt templates defined in `app/question_generation/prompts.py`.
    *   The AI service (`GeminiService` or `OllamaService`) generates the content based on the prompt.
    *   The `parse_llama_json` function parses the AI-generated response string into a structured JSON object.
    *   The function creates `Question` objects (defined in `app/question_generation/models.py`) from the parsed JSON data and adds them to a list.

11. **AI Service Implementations (GeminiService & OllamaService):**
    *   **`GeminiService`:**
        *   Uses the Google Gemini AI model to generate content.
        *   Requires a valid Gemini API key, configured using `genai.configure(api_key=user_api_key)`.
        *   The `generate_content` method calls the `model.generate_content` method and introduces a delay to manage rate limiting (using `asyncio.sleep(10)`).
        *   The `model_name` is set as `gemini-1.5-flash`.
    *   **`OllamaService`:**
        *   Sends requests to a local Ollama API endpoint for content generation.
        *   Uses the "deepseek-r1:14b" model.
        *   The `generate_content` method makes a POST request to the `OLLAMA_API_URL` with the prompt, model details, and configurations for the raw, non-streamed responses. Error handling checks the HTTP status code and manages unsuccessful API requests.

12. **JSON Parsing (`parse_llama_json`):**
    *   This utility function is crucial for extracting structured data from the AI-generated text. Since the AI model may not always produce perfectly formatted JSON, this function provides robust error handling.
    *   The function attempts to locate the start and end of the JSON object within the text using `text.find("{")` and `text.rfind("}")`.
    *   If the JSON delimiters are not found, it returns a default empty JSON structure.
    *   It uses `json.loads` to parse the JSON string. If parsing fails, it catches the exception and returns the default structure.
    *   The function ensures that the parsed object is a dictionary and contains a "questions" key.

13. **Data Display and Editing (Frontend):**
    *   The backend returns the `VideoResponse` object to the frontend.
    *   The frontend displays the generated questions, segments, video title, and description in editable fields.
    *   The user can modify the content and save the changes.
    *   The modified data is stored in the `modifiedResponseData` object and in IndexedDB.
    *   The IndexedDB stores the video data locally in the user's browser, providing offline access and data persistence.

14. **Data Upload to LMS (Frontend):**
    *   Once the user is satisfied with the generated content, they can click the "Confirm & Download" button.
    *   This triggers the process of uploading the video segments, assessment data, and questions to the LMS.
    *   The selected course, module, and section IDs are sent along with the video and question data.
    *   The JavaScript function triggered on the button click iterates through each video in `modifiedResponseData` and performs the following steps:
        *   Uploads each video segment to the LMS using the `config.VIDEO_UPLOAD_URL`.
        *   Creates a corresponding assessment for the segment using `config.ASSESSMENT_UPLOAD_URL`.
        *   Uploads the generated questions for each assessment to the LMS using `config.QUESTIONS_UPLOAD_URL`.
    *   The LMS API is expected to return the IDs of the created video, assessment, and questions.
    *   A sequence counter maintains the correct order of videos and assessments.
    *   IndexedDB is used to store the video, assessment, and question data locally, providing a backup in case of upload failures.

15. **Student Doubt Support (RAG):** Students can ask questions related to the video content, and the system leverages the uploaded transcripts in the vector database to provide relevant answers using RAG. This allows students to get answers quickly.

## 2. Code Structure

*   `app/main.py`: The main FastAPI application file. It defines the API endpoints, includes routers, configures CORS middleware, loads environment variables, and serves the homepage.
*   `app/routers/question.py`: Defines the API routers for question generation. It handles incoming requests for processing videos and retrieving playlist URLs, delegating the actual processing to the services layer.
*   `app/services.py`: Contains service functions that orchestrate the question generation process and initiates the RAG pipeline. It acts as an intermediary between the routers and the question generation/RAG logic. It handles the selection of AI services (Gemini or Ollama).
*   `app/question_generation/`: A directory containing the core question generation logic.
    *   `models.py`: Defines the data models (Pydantic models) used throughout the application, such as `VideoSegment`, `Question`, and `VideoResponse`.
    *   `services.py`: Contains the `VideoProcessor` and `PlaylistProcessor` classes. The `VideoProcessor` class handles the core video processing logic, including transcript retrieval, segment generation, and question generation. The `PlaylistProcessor` class handles the retrieval of video URLs from YouTube playlists. Contains the implementations of `GeminiService` and `OllamaService`.
    *   `utils.py`: Contains utility functions, such as `extract_video_id`, `hide_urls`, and `parse_llama_json`.
    *   `prompts.py`: Defines the prompt templates used for generating questions with the AI models. This file contains the `TASK_DESCRIPTION_ANALYTICAL`, `PROMPT_ANALYTICAL`, `TASK_DESCRIPTION_CASE_STUDY`, and `PROMPT_CASE_STUDY` variables, which are string templates used to construct the prompts sent to the AI models.
*   `app/templates/index.html`: The frontend HTML file, containing the user interface for submitting URLs, customizing segments, and viewing the generated questions, along with the mechanisms to upload the data.
*   `app/rag.py`: Contains the RAG related functions and files, such as functions to upload text to the vector database (FAISS) and query it.
*   `.env`: Contains environment variables, such as API keys and LMS URLs.

## 3. Key Components and Functionality

### 3.1. Frontend for Question Generation (app/templates/index.html)

*   **YouTube IFrame API:** The frontend utilizes the YouTube IFrame API to display videos and retrieve video metadata, such as duration. The `onYouTubeIframeAPIReady` function is called when the API is loaded. The `getVideoDuration` function uses the API to asynchronously retrieve the duration of a video.

*   **Event Listeners:** The Javascript code in `index.html` attaches various event listeners to the UI elements:

    *   **`#fetch-videos` (Submit button next to URL field):** Handles the submission of the YouTube URL. It calls the backend to retrieve the video URLs (if a playlist URL is submitted), retrieves the video durations, and displays the video blocks.
    *   **`#num-segments` (Number of Segments input):** Handles changes to the number of segments. It dynamically updates the segment blocks and their associated data.
    *   **`.video-block` (Video blocks):** Handles the selection of a video. It loads the video into the YouTube player and displays the corresponding segment blocks.
    *   **`.segment-block` (Segment blocks):** Handles the selection of a segment. It opens the segment form, allowing the user to customize the segment details.
    *   **`#questions` (Number of Questions input in segment details):** Handles changes to the number of questions for a segment.
    *   **`#type` (Type of Questions dropdown in segment details):** Handles changes to the question type for a segment.
    *   **`#timestamp-hr`, `#timestamp-min`, `#timestamp-sec` (Timestamp inputs in segment details):** Handles changes to the timestamp for a segment.
    *   **`#recalculate-timestamps` (Recalculate Timestamps button):** Recalculates the timestamps for all segments based on the number of segments and the video duration (distributes the segments equally within the video duration; meant to be used if needed after changing the number of segments for a video).
    *   **`#confirm-btn` (Confirm & Download button):** Handles the upload of the generated data to the LMS. It sends the video segments, assessment data, and questions to the LMS API.

*   **IndexedDB Integration:**

    *   The `QuestionIndexedDB` class provides a wrapper for interacting with the IndexedDB.
    *   `openDatabase()`: Opens the database or creates it if it doesn't exist. Includes the `onupgradeneeded` handler, which creates the `videos` object store if needed and sets up a secondary index for filtering videos by `section_id`.
    *   `saveVideoData(videoData)`: Stores video data in IndexedDB.
    *   `getVideoData(videoUrl)`: Retrieves video data from IndexedDB.
    *   `getAllVideos()`: Retrieves all video data from IndexedDB.

### 3.2. Backend for Question Generation (app/main.py, app/routers/question.py, app/services.py, app/question\_generation)

*   **FastAPI Application (app/main.py):** This file is the entry point for the backend application. It sets up the FastAPI application, configures CORS, loads environment variables from the `.env` file, includes the routers defined in `app/routers/question.py`, and defines a route for serving the homepage (`/`).

*   **API Routers (app/routers/question.py):** This file defines the API endpoints for the application using FastAPI's `APIRouter`.

    *   **`/questions/process_video` (POST):** This endpoint receives the video URL, API key, timestamps, and question parameters from the frontend and calls the `process_process_video` function in `app/services.py` to generate questions and upload transcripts for RAG.

    *   **`/questions/get_urls` (POST):** This endpoint receives a playlist URL from the frontend and calls the `get_urls` function in `app/services.py` to extract the video URLs from the playlist.

    *   All routes are defined with a `/questions` prefix.

*   **Services (app/services.py):** This file contains the business logic for the application.

    *   **`process_process_video(url: str, user_api_key: str, timestamps: List[int], segment_wise_q_no: List[int], segment_wise_q_model: List[str]) -> VideoResponse`:**

        *   **Inputs:**

            *   `url` (str): The URL of the YouTube video.

            *   `user_api_key` (str): The user's API key (Gemini or "ollama1064").

            *   `timestamps` (List[int]): A list of timestamps (in seconds) defining the start times of each segment.

            *   `segment_wise_q_no` (List[int]): A list of the number of questions to generate for each segment.

            *   `segment_wise_q_model` (List[str]): A list of the question types ("analytical" or "case-study") for each segment.

        *   This function is the main entry point for question generation. It receives the video URL, API key, timestamps, and question parameters from the router. It also initiates the upload of video transcripts for the RAG functionality.

        *   It selects the AI service (Gemini or Ollama) based on the API key.

        *   It instantiates a `VideoProcessor` object and calls its `process_video` method to generate questions.

        *   **Output:** `VideoResponse`: Object is returned to the router containing the processed segments and generated questions.

    *   **`get_urls(url: str) -> Dict[str, List[str]]`:**

        *   **Inputs:**

            *   `url` (str): The URL of the YouTube playlist.

        *   This function extracts the video URLs from a YouTube playlist URL.

        *   It instantiates a `PlaylistProcessor` object and calls its `get_urls_from_playlist` method to extract the video URLs.

        *   **Output:** `Dict[str, List[str]]`: A dictionary containing the list of video URLs (`{"video_urls": [...]}`).

*   **Question Generation (app/question\_generation):**

    *   **`models.py`:** Defines the data models used in the question generation process:

        *   **`VideoSegment`:** Represents a segment of a video, with its text, start time, and end time.

        *   **`Question`:** Represents a question, with its text, options, correct answer, and segment index.

        *   **`VideoResponse`:** Represents the response from the question generation process, containing a list of `VideoSegment` objects and a list of `Question` objects.

    *   **`services.py`:** Contains the `VideoProcessor` and `PlaylistProcessor` classes.

        *   **`VideoProcessor`:** This class handles the core video processing logic.

            *   **`process_video(url: str, user_api_key: str, timestamps: List[int], segment_wise_q_no: List[int], segment_wise_q_model: List[str]) -> VideoResponse`:**

                *   **Inputs:**

                    *   `url` (str): The URL of the YouTube video.

                    *   `user_api_key` (str): The user's API key (Gemini or "ollama1064").

                    *   `timestamps` (List[int]): A list of timestamps (in seconds) defining the start times of each segment.

                    *   `segment_wise_q_no` (List[int]): A list of the number of questions to generate for each segment.

                    *   `segment_wise_q_model` (List[str]): A list of the question types ("analytical" or "case-study") for each segment.

                *   This method performs the core video processing steps, including transcript retrieval, segment generation, question generation and full transcript upload for RAG.

                *   **Output:** `VideoResponse`: Object containing processed video segments and generated questions.

            *   **`get_raw_transcript(video_id: str) -> List[Dict]`:**

                *   **Input:**

                    *   `video_id` (str): The ID of the YouTube video.

                *   This method retrieves the video transcript from the YouTube Transcript API.

                *   **Output:** `List[Dict]`: A list of dictionaries, where each dictionary represents a transcript entry with `text`, `start`, and `duration` keys. Returns an empty list if no transcript is found.

            *   **`generate_transcript_segments(transcript: List[Dict], timestamps: List[int]) -> List[VideoSegment]`:**

                *   **Inputs:**

                    *   `transcript` (List[Dict]): The raw transcript from the YouTube Transcript API.

                    *   `timestamps` (List[int]): A list of timestamps (in seconds) defining the start times of each segment.

                *   This method divides the video into segments based on the provided timestamps and the transcript.

                *   **Output:** `List[VideoSegment]`: A list of VideoSegment objects, representing the video segments.

            *   **`process_audio_only(yt: YouTube, timestamps: List[int]) -> List[VideoSegment]`:**

                *   **Inputs:**

                    *   `yt` (YouTube): The YouTube object representing the video.

                    *   `timestamps` (List[int]): A list of timestamps (in seconds) defining the start times of each segment.

                *   This method downloads the audio from the video, segments the audio based on timestamps, calls `process_audio_segment` for each segment to transcribe it.

                *   **Output:** `List[VideoSegment]`: A list of `VideoSegment` objects, representing the transcribed audio segments.

            *   **`process_audio_segment(segment_file: str, start_time: float, end_time: float) -> VideoSegment`:**

                *   **Inputs:**

                    *   `segment_file` (str): The path to the audio segment file.

                    *   `start_time` (float): The start time of the segment (in seconds).

                    *   `end_time` (float): The end time of the segment (in seconds).

                *   This method transcribes a single audio segment using the Whisper model.

                *   **Output:** `VideoSegment`: A `VideoSegment` object representing the transcribed audio segment.

            *   **`generate_questions_for_segments(segments: List[VideoSegment], user_api_key: str, segment_wise_q_no: List[int], segment_wise_q_model: List[str]) -> List[Question]`:**

                *   **Inputs:**

                    *   `segments` (List[VideoSegment]): A list of `VideoSegment` objects.

                    *   `user_api_key` (str): The user's API key (Gemini or "ollama1064").

                    *   `segment_wise_q_no` (List[int]): A list of the number of questions to generate for each segment.

                    *   `segment_wise_q_model` (List[str]): A list of the question types ("analytical" or "case-study") for each segment.

                *   This method generates questions for each segment using the AI service.

                *   **Output:** `List[Question]`: A list of `Question` objects, representing the generated questions.

            *   **`generate_questions_from_prompt(text: str, user_api_key: str, n_questions: int, q_model: str) -> str`:**

                *   **Inputs:**

                    *   `text` (str): The text content from the current video segment.

                    *   `user_api_key` (str): The API key provided by the user.

                    *   `n_questions` (int): The number of questions to generate.

                    *   `q_model` (str): The type of question model (analytical or case study).

                *   Generates questions using AI service, the prompt is received from `_get_prompt`.

                *   **Output:** `str`: AI-generated questions (as a string).

            *   **`_get_prompt(text:str, n: int, q_model: str) -> str`:**

                *   **Inputs:**

                    *   `text` (str): The text content from the current video segment.

                    *   `n` (int): The number of questions to generate.

                    *   `q_model` (str): The type of question model (analytical or case study).

                *   Creates appropriate prompts for the LLM based on the requirements, taking into account the number of questions and the type of questions.

                *   **Output:** `str`: The formatted prompt for the LLM.

        *   **`PlaylistProcessor`:** This class handles the retrieval of video URLs from YouTube playlists.

            *   **`get_urls_from_playlist(playlist_url: str) -> Dict[str, List[str]]`:**

                *   **Input:**

                    *   `playlist_url` (str): The URL of the YouTube playlist.

                *   This method extracts the video URLs from a YouTube playlist URL using the `pytubefix` library.

                *   **Output:** `Dict[str, List[str]]`: A dictionary containing a list of video URLs.

    *   **`utils.py`:** Contains utility functions:

        *   **`extract_video_id(url: str) -> Optional[str]`:**

            *   **Input:**

                *   `url` (str): The YouTube video or playlist URL.

            *   Extracts the video ID from a YouTube URL using regular expressions.

            *   **Output:** `Optional[str]`: The extracted video ID, or None if no ID is found.

        *   **`hide_urls(text: str) -> str`:**

            *   **Input:**

                *   `text` (str): The text to process.

            *   Removes URLs from a string, replacing them with `<url_hidden>`.

            *   **Output:** `str`: The text with URLs hidden.

        *   **`parse_llama_json(text: str) -> Dict`:**

            *   **Input:**

                *   `text` (str): JSON string containing question data.

            *   Parses a JSON string, handling potential errors.

            *   **Output:** `Dict`: The parsed JSON as a Python dictionary.

    *   **`prompts.py`:** Defines the prompt templates used for generating questions with the AI models.

### 3.3. Backend for Student AI Support For Doubts (RAG Implementation in `app/rag.py`)

*   **Overview:** This section details the backend components responsible for providing AI support to students by answering their doubts related to the video content. This is implemented using Retrieval-Augmented Generation (RAG) with Langchain and Hugging Face embeddings.

*   **Key Classes:**

    *   **`AsyncLockManager`:** Manages asynchronous file-based locks to prevent concurrent access to the vector store.

        *   **`__init__(lock_dir: str)`:** Initializes the lock manager with the directory where the lock file will be stored.
            *   **Input:**
                *   `lock_dir` (str): The directory path where the lock file will be created.
        *   **`acquire() -> AsyncContextManager`:** Acquires the lock asynchronously, creating a lock file as a signal.
            *   **Output:** An asynchronous context manager.
        *   **`cleanup()`:** Removes the lock file if it exists.

    *   **`VectorStoreManager`:** Manages the FAISS vector store, including loading, creating, and saving the store. The FAISS index stores vector embeddings of the video transcripts.

        *   **`__init__(base_dir: str, embeddings)`:** Initializes the vector store manager with the base directory for storing the index and the embedding model.
            *   **Inputs:**
                *   `base_dir` (str): The base directory where the FAISS index will be stored.
                *   `embeddings`: The Hugging Face embeddings model used to generate vector embeddings.
        *   **`load_or_create() -> FAISS`:** Loads an existing FAISS index from disk or creates a new one if it doesn't exist. If no index is available at `index_path`, a new store is created.
            *   **Output:** `FAISS`: The loaded or created FAISS index.
        *   **`save_store(store: FAISS)`:** Saves the FAISS index to disk. This allows the index to be persisted for future use and avoids the need to rebuild it every time the application starts.
            *   **Input:**
                *   `store` (FAISS): The FAISS index to save.

    *   **`QueryManager`:** Handles processing user queries using the RAG pipeline. It is responsible for retrieving relevant documents from the vector store and generating a response using the LLM.

        *   **`__init__(vector_store_manager: VectorStoreManager, model: ChatGoogleGenerativeAI)`:** Initializes the query manager with the vector store manager and the LLM. The `model` is configured as "gemini-1.5-flash"
            *   **Inputs:**
                *   `vector_store_manager` (VectorStoreManager): The vector store manager used to access the FAISS index.
                *   `model` (ChatGoogleGenerativeAI): The Large Language Model (LLM) used for generating responses (currently ChatGoogleGenerativeAI).
        *   **`setup_chain(store: FAISS)`:** Sets up the Langchain retrieval chain using the provided vector store. Configures the retriever with similarity search, using k=2 (the number of documents to retrieve). Sets up `stuff_documents_chain` using the LLM and Prompt.
            *   **Input:** `store` (FAISS) - Vector store to be used.
            *   **Output:** Retrieval chain.
        *   **`query(question: str) -> Dict`:** Processes a user query, retrieves relevant documents from the vector store, and generates a response using the LLM.
            *   **Input:**
                *   `question` (str): The user's question.
            *   **Output:** `Dict` - A dictionary containing:
                *   `response` (str): Response from the model.
                *   `processing_time` (str): Query processing time.
                *   `error` (str, optional): Error if any occurred.

    *   **`ContentManager`:** Manages the process of uploading and indexing new content in the vector store. This includes splitting the document into chunks using the `text_splitter`, filtering the chunks for uniqueness, and adding the unique chunks to the vector store.

        *   **`__init__(vector_store_manager: VectorStoreManager, text_splitter)`:** Initializes the content manager with the vector store manager and the text splitter.
             *   **Inputs:**
                *   `vector_store_manager` (VectorStoreManager): Vector store to use.
                *   `text_splitter`: instance of Text Splitter object. `SemanticChunker` is used here.
        *   **`get_content_hash(text: str) -> str`:** Generates a SHA256 hash of the content for deduplication purposes. This allows us to avoid adding duplicate content to the vector store.
             *   **Input:** Text to hash.
             *   **Output:** A SHA256 hash of the text.
        *   **`upload_content(text: str, title: Optional[str] = None) -> Dict`:** Uploads and indexes new content in the vector store. Splits documents using `text_splitter`, filters for unique chunks and adds them to the store. The splitting is performed using `SemanticChunker`, which splits the text into chunks based on semantic similarity.
             *   **Inputs:**
                *   `text` (str): Text to process.
                *   `title` (Optional[str], optional): Metadata title. Defaults to `None`.
             *   **Output:** `Dict`:
                    *   `message`: Message showing numbers of new sections added
                    *   `error`: Error if any.
        *   **`_filter_unique_documents(store: FAISS, documents, main_hash) -> List`:** Filters out documents that already exist in the vector store, using a document hash. The document hash is calculated using the SHA256 hash of the chunk. Also removes the blanks by checking `doc.page_content.strip()`.
             *   **Inputs:**
                *   `store`: FAISS vector store
                *   `documents`: Document to filter.
                *   `main_hash`: Hash
             *   **Output** Unique documents.

*   **Initialization and Shutdown:**

    *   **Startup Event (`startup_event`):** Called when the FastAPI application starts.
        *   Initializes the core components of the RAG system: `HuggingFaceEmbeddings`, `SemanticChunker`, `ChatGoogleGenerativeAI`, `VectorStoreManager`, `ContentManager`, and `QueryManager` instances.
        *   Configures the `ChatGoogleGenerativeAI` model using the `API_KEY`.
    *   **Shutdown Event (`shutdown_event`):** Called when the FastAPI application shuts down.
        *   Releases resources by cleaning up the lock file managed by `AsyncLockManager` and shutting down the thread pool used by `ContentManager`.

*   **API Endpoints:**

    *   **`upload_text(text: str = Form(...), title: Optional[str] = Form(None)) -> JSONResponse`:** This endpoint is used to upload new content to the RAG system.
        *   It receives the text and optional title from the request form.
        *   The `ContentManager` then processes this content, splits it into chunks, and adds it to the FAISS index.
        *   **Inputs:**
            *   `text` (str): The text content to upload.
            *   `title` (Optional[str]): An optional title for the content.
        *   **Output:** `JSONResponse`: A JSON response indicating the success or failure of the upload operation.
    *   **`query_content(question: str = Form(...)) -> JSONResponse`:** This endpoint is used to query the RAG system.
        *   It receives the user's question from the request form.
        *   The `QueryManager` then processes this question by retrieving relevant documents from the FAISS index and generating a response using the LLM.
        *   **Input:**
            *   `question` (str): The user's question.
        *   **Output:** `JSONResponse`: The response from the LLM, including response, query processing time, and error if it occurred.
    *   **`get_content_index() -> contents`:** This endpoint returns a list of uploaded video chunks.
         * **Output:** `content`: Stored materials. Shows the chunk_hash, title, length, and preview.

## 4. Environment Variables

The application relies on the following environment variables, which should be defined in the `.env` file:

*   `LMS_GET_URL`: The URL of the LMS API endpoint for retrieving course, module, and section data. This is used by the frontend to populate the dropdown menus.
*   `VIDEO_UPLOAD_URL`: The URL of the LMS API endpoint for uploading video segments.
*   `ASSESSMENT_UPLOAD_URL`: The URL of the LMS API endpoint for uploading assessment data.
*   `QUESTIONS_UPLOAD_URL`: The URL of the LMS API endpoint for uploading questions.
*   `API_KEY`: The Gemini API key used by the backend to authenticate with the Gemini AI service (used both for question generation and RAG model).
*   `OLLAMA_API_URL`: The URL of the Ollama API endpoint.
*   `FFMPEG_PATH`: The path to the `ffmpeg` executable. This is required for converting audio files.
*   `Authorization`: Authorization token to authenticate the requests sent to the LMS.

## 5. Data Flow

1.  User provides the input video URL, the course->module->section hierarchy from LMS engine and the default configurations.
2.  Frontend makes a POST request to `/questions/get_urls` if the user inputs a playlist URL, to get a list of video URLs to process.
3.  Frontend receives a list of video URLs.
4.  For each video URL, the video information (especially the number of segments, questions per segment and segment-wise question type requirements) is customized in the frontend and saved in a dictionary.
5.  The Frontend makes batches of the list of video URLs (total segments <=15 in each)
6.  For each batch, make a POST request to `/questions/process_video` endpoint to process the video information, and sends the video URL, user API key, timestamps, segment_wise_q_no, segment_wise_q_model.
7.  The `process_process_video` function in `app/services.py` receives the request.
8.  The `process_process_video` function chooses the service to use (GeminiService or OllamaService) based on the api key received.
9.  A `VideoProcessor` is created using that service.
10. `VideoProcessor.process_video` is called and the LLM magic starts; video processing, segment generation, question generation, and finally RAG full text upload for the current video.
11. The backend processes the video, and creates a list of segments, question, video details, and the `VideoResponse` is returned.
12. The frontend receives the `VideoResponse`, shows the video boxes, and on each video box click, the video details, segment boxes, segment details form, and question boxes are rendered.
13. All data is now displayed in editable format to the user.
14. The `saveVideoEdits` function saves these modifications to a new array called `modifiedResponseData`, which is a deep copy of `responseData`.
15. A `showVideoOutput` function retrieves existing data from IndexedDB and shows it, otherwise it shows `modifiedResponseData`.
16. The modified data is uploaded to the LMS via POST requests.

## 6. Error Handling

*   **Frontend:**
    *   Displays error messages to the user using the `<div class="error-message">` element.
    *   Handles network errors and API errors.
    *   IndexedDB is used to store video, assessment, and question data locally, providing a backup in case of upload failures.
*   **Backend:**
    *   Uses FastAPI's exception handling mechanisms to return appropriate HTTP error codes and error messages to the frontend.
    *   Catches exceptions during video processing, question generation, RAG and API calls.
    *   Logs errors to the console.
    *   The `parse_llama_json` function handles potential errors during JSON parsing.

## 7. Important Points To Note:

*   The Gemini model being used as of now, Gemini 1.5 Flash, allows 15 API requests per minute. Therefore each batch of videos contains 15 segments; with a 90 second sleep time (to be sure there's no crash) between batches. This can be modified accordingly, especially because when using local Ollama models the sleep time will not be required.
*   Gemini's latest model Gemini 2.0 Flash allows 10 API requests per minute; so if that is used, modify the number of segments per batch.
*   Timestamps: The start time of each segment is taken as input from the front end, in hr,min,sec format. First segment's timestamp is by default 0 hr, 0 min, 0 sec (non-editable).
*   When youtube transcripts are unavailable (due to no subtitles/wrong language subtitles), the audio processing for transcription requires FFMPEG, which needs local configuration. To match the current code, the ffmpeg root folder (that contains the bin folder which has the ffmpeg executable) needs to named "ffmpeg" and placed directly in the C drive (for windows).
*   Keep an eye on the env variables (Gemini API Key, FFMPEG Path, URLs, Access Token).

## 8. Installing and running the application

1. Clone the repository and switch to the directory "ai_engine":
   ```bash
   git clone https://github.com/sudarshansudarshan/cal.git
   cd cal/backend/ai_engine
   ```
2. Create a virtual environment and activate it.
   ```bash
   python -m venv venv
   .\venv\Scripts\activate
   ```

3. Install the required dependencies:
   ```bash
   pip install -r requirements.txt
   ```

4. Start the application:
   ```bash
   uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4
   ```

5. The application can be accessed at "127.0.0.1:8000/".

Note for developers:
Use the following commands before restarting the application after changes:
   ```bash
   Get-ChildItem -Recurse -Directory -Filter "__pycache__" | Remove-Item -Recurse -Force
   Get-Process | Where-Object { $_.Name -like "*python*" } | Stop-Process -Force
   ```

## 10. Potential Improvements and Future Enhancements

*   **Question Generation Backend:**
    * If the no. of requests made to Gemini could be reduced in some way (for example, 1 request per video instead of 1 request per segment), it would be way more efficient.
    * Allow instructors to provide customized prompts, and append it with our own pre-written prompt.
    * More variations of question types.
*   **Question Generation Frontend:**
    *   When the video information is fetched after giving the url, automatically set the current video (selected box) to video 1.
*   **RAG:**
    *   Store history and allow follow up questions (one possible implementation: Store the chat history on the client's side with a window of last 7-10 prompts and responses, and send it to the LLM in the next prompt.)

This documentation provides a comprehensive overview of the LLM Backend API, encompassing both question generation and AI-powered doubt support using RAG. By understanding the architecture, code structure, data flow, and key components, developers can effectively maintain, troubleshoot, and enhance the application's functionality. This should enable the smooth transfer of the application to its new maintainer and set the stage for future improvements.