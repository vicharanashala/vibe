# Activity Engine

This is the activity engine developed in Node.js using TypeScript. We are using Prisma for interaction between the backend and the database.

## Installation

To install and run the project, follow these steps:

1. Install the dependencies:
    ```bash
    npm install
    ```
2. Run the development server:
    ```bash
    npm run dev
    ```

## Prerequisites

- Node.js (latest version)
- PostgreSQL database

## Setup

### Database Configuration

To set up your database in this application, you need to create a `.env` file in the root directory of your project. In this file, define the `DATABASE_URL` with your PostgreSQL database URL:

```
DATABASE_URL="your_postgres_database_url"
```

### Google Authentication

To implement Google authentication, follow these steps:

1. Create a credentials file in JSON format (e.g., `file.json`) containing all your Google Auth Firebase Admin credentials.
2. Add the path to your credentials file in the `.env` file:

```
FIREBASE_ADMIN_SDK_PATH=path_to_your_credentials_file.json
```

## Updated Folder Structure

```
activity_engine
|- src
|  |- controller (contains different controllers for each API call functionality)
|  |- middleware (contains googleAuthentication middleware responsible for authenticating the user)
|  |- routes (contains different route files with all backend routes)
|  |- repositories (contains all repository files)
|  |- services (contains all services for each functionality)
|  |- types (contains types for different elements)
|  |- constant.ts (contains the URL of the LM engine)
|  |- server.ts (Express server file)
|- prisma
|  |- migrations (contains all migrations)
|  |- schema.prisma (contains the Prisma schema or database schema for data storage)
```