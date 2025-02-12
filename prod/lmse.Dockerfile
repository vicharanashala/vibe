# Builder Stage
FROM python:3.12-slim AS builder

WORKDIR /app

RUN pip install --no-cache-dir poetry

COPY pyproject.toml poetry.lock ./

RUN poetry config virtualenvs.create false && poetry install --with main --no-interaction --no-ansi

# Runtime Stage
FROM python:3.12-slim AS runtime
WORKDIR /app

COPY --from=builder /usr/local/lib/python3.12/site-packages /usr/local/lib/python3.12/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin

COPY . .

EXPOSE 8000

CMD ["sh", "-c", "python3 manage.py migrate && python3 manage.py collectstatic --noinput && gunicorn --workers=4 --bind 0.0.0.0:8000 core.wsgi:application"]
