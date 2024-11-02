# Contributing to the CAL Project

We welcome contributions to the CAL project. Please read the following guidelines before contributing.

## Project Structure

The CAL project is structured as follows:

- `frontend/`
- `backend/`
- `docs/`: Contains design documents and community guidelines.

## Backend

### Structure

- `cal_backend/`: Contains the Django project.
- `cal_backend/<app_name>/`: Django apps.
- `.devcontainer/`: Contains the VS Code development container configuration.
- `dev/`: Contains docker-compose files for development.

### Setup

1. Install Docker and Docker Compose.

2. Clone the repository.

```bash
git clone github.com/Computer-Science-Group/cal.git
```

3. Change to the backend directory.

```bash
cd cal/backend
```

If you plan to use the development container, open the project in VS Code and click on the "Reopen in Container" button and you're done!

For docker compose, run the following command:

```bash
docker-compose -f dev/docker-compose.yml up
```


The backend service will be running on `localhost:8000`.

