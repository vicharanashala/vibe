# Use official Python base image
FROM python:3.10

# Set environment variables
ENV PYTHONUNBUFFERED=1
ENV PORT=8000
ENV PATH="/root/.local/bin:$PATH"


# Install dependencies
RUN apt-get update && apt-get install -y libpq-dev && rm -rf /var/lib/apt/lists/*

# Install Poetry
RUN curl -sSL https://install.python-poetry.org | python3 -

# Set working directory
WORKDIR /app

# Copy only dependency files first for better caching
COPY pyproject.toml poetry.lock README.md ./

# Install dependencies using Poetry
RUN /root/.local/bin/poetry install

# Copy the rest of the application
COPY . .

# Expose the application port
EXPOSE 8000

# Start the application (Run collectstatic after starting)
CMD ["bash", "-c", "poetry run python3 manage.py migrate && poetry run python3 manage.py collectstatic --noinput && poetry run gunicorn --workers 4 --timeout 120 --bind 0.0.0.0:$PORT core.wsgi:application"]
