import os
import sys
import uvicorn
from chatbot_service import app

if __name__ == "__main__":
    if app is None:
        print("Error: FastAPI application is not initialized. Ensure FastAPI is installed.")
        sys.exit(1)

    host = os.environ.get("CHATBOT_PYTHON_HOST", "127.0.0.1")
    port = int(os.environ.get("CHATBOT_PYTHON_PORT", "5001"))
    print(f"Starting Python Chatbot microservice on {host}:{port}...")
    uvicorn.run(app, host=host, port=port)
