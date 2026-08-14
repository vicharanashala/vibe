import os
import sys
import argparse
import json
from dotenv import load_dotenv

# Load environment variables from .env files if present
load_dotenv()

# Guarded top-level imports for Google Gemini SDKs
try:
    from google import genai
    from google.genai import types
    HAS_GENAI = True
except ImportError:
    genai = None  # type: ignore
    types = None  # type: ignore
    HAS_GENAI = False

import warnings
with warnings.catch_warnings():
    warnings.simplefilter("ignore", category=FutureWarning)
    try:
        import google.generativeai as legacy_genai
        HAS_LEGACY_GENAI = True
    except ImportError:
        legacy_genai = None  # type: ignore
        HAS_LEGACY_GENAI = False

# FastAPI, Pydantic, and Uvicorn imports
from fastapi import FastAPI
from pydantic import BaseModel
import uvicorn
HAS_FASTAPI = True

PREFERRED_MODELS = [
    'gemini-flash-latest',
    'gemini-2.0-flash',
    'gemini-2.0-flash-lite',
    'gemini-pro-latest',
]

def query_gemini(question: str, context: str = "") -> str:
    """Queries the Google Gemini API using Python SDK with system prompt and context."""
    if not question or not question.strip():
        return "Question cannot be empty."

    api_key = os.environ.get("GEMINI_API_KEY", "").strip()
    if not api_key:
        return (
            "Hello! I am Vibe's AI assistant. How can I help you today? "
            "(Note: A Google Gemini API key needs to be configured in GEMINI_API_KEY for full AI responses)."
        )

    system_prompt = (
        "You are Vibe's AI assistant.\n"
        "You are a helpful, knowledgeable assistant that can answer any question the user asks, whether they are currently enrolled in courses or not.\n"
        "Always respond in a polite, clear, and helpful tone.\n\n"
        "Formatting Guidelines:\n"
        "- Output clean, well-structured plain text. Do NOT use Markdown formatting syntax (do NOT use **, #, *, _, `, ```, or markdown tags).\n"
        "- Use clear section titles in plain text, standard paragraph breaks, and simple numbered lists (1., 2.) or dash bullet points (- item).\n"
        "- Ensure the response is well-formatted, professional, and easy to read.\n\n"
    )

    if context and context.strip():
        system_prompt += f"The user is enrolled in the following courses. If their question relates to this content, prefer using it in your answer:\n\nCourse Context:\n{context}\n\n"
    else:
        system_prompt += "The user is not currently enrolled in any course, or no active course context was found. Answer their questions using your general knowledge.\n\n"

    system_prompt += "Answer the user's question accurately and helpfully."

    last_err = None
    for model_name in PREFERRED_MODELS:
        try:
            if HAS_GENAI and genai is not None and types is not None:
                client = genai.Client(api_key=api_key)
                response = client.models.generate_content(
                    model=model_name,
                    contents=question,
                    config=types.GenerateContentConfig(
                        system_instruction=system_prompt,
                        temperature=0.7,
                        max_output_tokens=2000
                    )
                )
                if response and response.text:
                    return response.text.strip()
            elif HAS_LEGACY_GENAI and legacy_genai is not None:
                legacy_genai.configure(api_key=api_key)
                model = legacy_genai.GenerativeModel(
                    model_name=model_name,
                    system_instruction=system_prompt
                )
                response = model.generate_content(
                    question,
                    generation_config={'temperature': 0.7, 'max_output_tokens': 2000}
                )
                if response and response.text:
                    return response.text.strip()
            else:
                return "Neither 'google-genai' nor 'google-generativeai' SDK is installed."
        except Exception as err:
            last_err = err
            err_msg = str(err)
            sys.stderr.write(f"Gemini model {model_name} failed: {err_msg}\n")
            if any(k in err_msg for k in ['404', 'NOT_FOUND', 'no longer available', '429', 'RESOURCE_EXHAUSTED', 'Quota exceeded']):
                continue  # try next model
            break

    if last_err:
        err_msg = str(last_err)
        if any(k in err_msg for k in ['API key', 'API_KEY', 'INVALID_ARGUMENT']) or ('400' in err_msg and 'key' in err_msg.lower()):
            return (
                f'Hello! I am Vibe\'s AI assistant. I received your question ("{question}"), '
                'but the configured Gemini API key appears invalid or expired. '
                'Please update GEMINI_API_KEY with a valid Google Gemini API key to enable live AI responses.'
            )
        if any(k in err_msg for k in ['429', 'RESOURCE_EXHAUSTED', 'Quota exceeded']):
            return (
                f'Hello! I am Vibe\'s AI assistant. Gemini API rate limit or quota has been reached. '
                'Please try again in a few moments or check your GEMINI_API_KEY quota.'
            )
        return f"Failed to get response from AI assistant: {err_msg}"

    return "I am sorry, but I received an empty response from Gemini."


# FastAPI Application
if HAS_FASTAPI and FastAPI is not None:
    class QueryRequest(BaseModel):
        question: str
        context: str = ""

    class QueryResponse(BaseModel):
        response: str

    app = FastAPI(title="Vibe Python Chatbot Service", version="1.0.0")

    @app.get("/health")
    @app.head("/health")
    def health_check():
        return {"status": "ok", "service": "vibe-chatbot-python"}

    @app.post("/query", response_model=QueryResponse)
    def handle_query(req: QueryRequest):
        ans = query_gemini(req.question, req.context)
        return QueryResponse(response=ans)
else:
    app = None


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Vibe Python Chatbot CLI / Service")
    parser.add_argument("--server", action="store_true", help="Start FastAPI server")
    parser.add_argument("--host", default="127.0.0.1", help="Host address for FastAPI server")
    parser.add_argument("--port", type=int, default=5001, help="Port for FastAPI server")
    parser.add_argument("--question", type=str, help="Question to ask Gemini")
    parser.add_argument("--context", type=str, default="", help="Optional context for question")
    parser.add_argument("--json", action="store_true", help="Output JSON result for CLI")

    args = parser.parse_args()

    if args.server:
        if app is None or uvicorn is None:
            print("FastAPI / uvicorn not installed. Cannot start server.")
            sys.exit(1)
        print(f"Starting Vibe Python Chatbot service on http://{args.host}:{args.port}")
        uvicorn.run(app, host=args.host, port=args.port)
    elif args.question:
        ans = query_gemini(args.question, args.context)
        if args.json:
            print(json.dumps({"response": ans}))
        else:
            print(ans)
    else:
        if not sys.stdin.isatty():
            try:
                input_data = json.load(sys.stdin)
                q = input_data.get("question", "")
                c = input_data.get("context", "")
                ans = query_gemini(q, c)
                print(json.dumps({"response": ans}))
            except Exception as e:
                print(json.dumps({"error": str(e)}))
        else:
            parser.print_help()

