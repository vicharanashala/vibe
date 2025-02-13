# CAL LMS Engine - Developer Setup Guide

This guide provides step-by-step instructions to set up the **CAL LMS Engine** using **Poetry** for dependency management and **Docker** for containerization.

---

## Prerequisites

Ensure you have the following installed on your system:

- **Python 3.10+**
- **Poetry** (for package and dependency management)
- **Docker** and **Docker Compose**
- **Git**

---

## 1. Install Poetry

If Poetry is not installed, use the following command:

```sh
curl -sSL https://install.python-poetry.org | python3 -
```

Verify installation:

```sh
poetry --version
```

### Add Poetry to PATH (Linux)

After installing Poetry, add its bin directory to your system's PATH permanently:

```sh
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc
```

For Zsh users:

```sh
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

---

## 2. Clone the Repository

```sh
git clone <repository-url>
cd lms_engine
```

---

## 3. Setup with Poetry (Local Development)

### Install Dependencies

```sh
poetry install
```

### Create `.env` File

Before running the application, create a `.env` file in the root directory to store environment variables, including Firebase credentials:

```ini
FIREBASE_ADMIN_SDK_CREDENTIALS_PATH=/path/to/firebase/credentials.json
```

This file is not included in version control and must be manually set up.

### Activate Virtual Environment

```sh
poetry env use python3
poetry env info
```

### Apply Migrations

Optionally, you can generate the migration files before running the migrate command:

```sh
poetry run python3 manage.py makemigrations users institution course assessment
```

Then, apply the migrations:

```sh
poetry run python3 manage.py migrate
```

### Create a Superuser

```sh
poetry run python3 manage.py createsuperuser
```

Follow the prompts to set up an admin user.

### Run Development Server

```sh
poetry run python3 manage.py runserver
```

The LMS API should now be available at **[http://127.0.0.1:8000/](http://127.0.0.1:8000/)**.

---

## 4. Setup with Docker (Production/Containerized Environment)

0. Install infisical, guide https://infisical.com/docs/cli/overview
1.  infisical init
2.   infisical run --env=prod --path=/LMS_ENGINE/ poetry run python3 manage.py runserver

This method is primarily suited for **deployment** but can also be used for local development.

### Install Docker (if not installed)

Refer to the official Docker installation guide: [Docker Install](https://docs.docker.com/get-docker/)

### Build and Start the Container

```sh
docker build -t cal-lms-engine .
docker-compose up -d
```

### Apply Migrations (Inside Container)

```sh
docker-compose exec web python manage.py migrate
```

### Create Superuser (Inside Container)

```sh
docker-compose exec web python manage.py createsuperuser
```

### Check Logs

```sh
docker-compose logs -f
```

---

## 5. Environment Variables

Ensure you have a `.env` file in the root directory with the required environment variables. Example:

```ini
DJANGO_SECRET_KEY=your_secret_key
DEBUG=True
DATABASE_URL=postgres://user:password@db:5432/lms_db
ALLOWED_HOSTS=localhost,127.0.0.1
FIREBASE_ADMIN_SDK_CREDENTIALS_PATH=/path/to/firebase/credentials.json
```

For **Docker**, environment variables can be managed inside `docker-compose.yml`.

### Firebase Authentication Setup

Since the `.env` file is not uploaded to version control, ensure you manually provide the correct path to your Firebase Admin SDK credentials.

Example:

```sh
export FIREBASE_ADMIN_SDK_CREDENTIALS_PATH=/absolute/path/to/your/firebase/credentials.json
```

If this variable is missing, Django will throw an `UndefinedValueError` during startup.

---

## 6. Running Tests

To run tests locally:

```sh
pytest
```

To run tests inside Docker:

```sh
docker-compose exec web pytest
```

---

## 7. API Documentation

Once the server is running, access the API documentation at:

- **Scalar UI:** `http://127.0.0.1:8000/api/v1/docs`

---

## 8. Stopping and Cleaning Up

To stop the container:

```sh
docker-compose down
```

To remove unused containers, networks, and volumes:

```sh
docker system prune -a
```

---


## 🚀 Linting and Formatting

This project uses **Flake8** for linting and **Black** for code formatting to maintain code quality and consistency.

### ✅ Running Linters and Formatters
To check for linting and formatting issues, run:
```sh
flake8 .
black --check .
```

### 🔹 Excluding `__init__.py` Files from Linting
`__init__.py` files often contain imports that define module structure, which can lead to **circular imports** when running linters. To **exclude `__init__.py` from linting**, use:

```sh
autoflake --exclude=**/__init__.py -r .
```

### 🛠️ Best Practices to Avoid Linting Issues

Following these best practices will help maintain clean, readable, and error-free code:

### 🔹 General Code Formatting
- ✅ **Keep lines under 88 characters** (avoid `E501` errors).
- ✅ **Use consistent indentation (4 spaces per level)** to prevent `E101` and `E111`.
- ✅ **Avoid trailing whitespace** (`W291` - whitespace at the end of a line).
- ✅ **Use meaningful variable and function names** to prevent confusion.
- ✅ **Break long expressions into multiple lines** using parentheses.

### 🔹 Import Handling
- ✅ **Avoid wildcard imports (`*`)**, always use explicit imports to prevent `F403/F405` errors.
- ✅ **Group imports logically**:
  - Standard library imports first.
  - Third-party libraries next.
  - Local application imports last.
  - Example:
    ```python
    import os  # Standard library
    import numpy as np  # Third-party library
    from my_project.utils import helper_function  # Local module
    ```
- ✅ **Remove unused imports** to avoid `F401` errors:


## 9. Additional Notes

- Ensure database migrations are applied before running the server.
- Update `.env` with correct database credentials.
- Use `docker-compose.override.yml` for local configurations.
- Ensure `FIREBASE_ADMIN_SDK_CREDENTIALS_PATH` is correctly set up to avoid authentication errors.

For any issues, check logs and confirm dependencies are correctly installed.

---

## 10. Local Development, Build and Deploy

For local development, 
Initialize gcloud CLI and run - 
`gcloud auth application-default login`

Build- `sudo docker build -t vicharanashala/calm:v0.0.17 -f prod/lmse.Dockerfile backend/lms_engine/`
Push- `sudo docker push vicharanashala/calm:v0.0.17`
Deploy-
```
gcloud run deploy calm-lmse \
--image=docker.io/vicharanashala/calm:v0.0.17 \
--set-env-vars=LMSE_DJANGO_ENVIRONMENT=production \
--set-env-vars='LMSE_DJANGO_SECRET_KEY=__SECRET__' \
--set-env-vars=LMSE_DB_HOST=__SECRET__ \
--set-env-vars=LMSE_DB_NAME=__SECRET__ \
--set-env-vars=LMSE_DB_PASSWORD=__SECRET__ \
--set-env-vars=LMSE_DB_PORT=__SECRET__ \
--set-env-vars=LMSE_DB_USER=__SECRET__ \
--set-env-vars='^#^LMSE_ALLOWED_HOSTS=__CSV_ENV__' \
--set-env-vars='^#^LMSE_CORS_ALLOWED_ORIGINS=__CSV_ENV__' \
--set-env-vars=LMSE_SECURE_SSL_REDIRECT=0 \
--set-env-vars='LMSE_SENTRY_DSN=__SECRET__' \
--set-env-vars=LMSE_GCP_BUCKET_NAME=__SECRET__ \
--set-env-vars='LMSE_STATIC_URL=__SECRET__' \
--set-env-vars='^#^LMSE_CSRF_TRUSTED_ORIGINS=__CSV_ENV__' \
--set-env-vars='ACTIVITY_ENGINE_URL=__SECRET__' \
--region=asia-south2 \
--project=vicharanashala-calm \
 && gcloud run services update-traffic calm-lmse --to-latest
```


---

## Contributing

Feel free to contribute to the CAL LMS Engine. Fork the repo, create a feature branch, and submit a PR.

---

Happy coding! 🚀

