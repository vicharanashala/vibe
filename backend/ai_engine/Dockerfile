# Step 1: Use a lightweight Python base image
FROM python:3.9-slim

# Step 2: Set the working directory inside the container
WORKDIR /app

# Step 3: Copy all project files into the container
COPY . /app

# Step 4: Set PYTHONPATH to allow proper imports
ENV PYTHONPATH="/app"

# Step 5: Install dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Step 5: Expose the correct port (8000, since FastAPI runs here)
EXPOSE 8000

# Step 6: Run Uvicorn to keep the server running
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
