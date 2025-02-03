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