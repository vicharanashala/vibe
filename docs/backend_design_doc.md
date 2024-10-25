# CAL Backend Design Documenation

The CAL software consists of LMS software + advanced active learning features. The backend requires 

1. a **database** to store the data
2. **APIs** to access and modify this data
3. **Video management** system to store and manage videos

After considering and evaluating various options (see [Research](#research)), we have decided to use the following technologies for the backend:

**Firebase**

1. **Firestore** for the database
2. A middleware server (**Python FastAPI**) to handle the APIs which will interact with Firebase services
3. For the time being, we will use **YouTube** for video management

## Database Schema

The schema for the Firestore database is present in the [db_schema.md](./db_schema.md) file. Some components of the schema are free to change as the project progresses, even after the release of v1.0.0.
Firebase Firestore uses security rules to control access to the database which will be based on the schema and security access logic.

## API Structure

The API structure is present in the [api_structure.md](./api_structure.md) file.
It is guaranteed that existing APIs will not be removed or changed in a way that breaks existing clients. New APIs can be added in future versions.

## Security

1. **Firebase Authentication** will be used for user authentication
2. **Firebase Security Rules** will be used to control access to the database

TODO: Look into API access control and source verification

## Maintenance Infrastructure

1. **GitHub Actions** will be used for CI/CD
2. **Docker** will be used for containerization

## Deployment

> WARNING: Work in progress

Options for middleware deployment:

1. **Docker on EC2 or Elastic Beanstalk** to deploy as Docker containers
2. **AWS Lambda with API Gateway** for serverless deployment

## Research

1. Node.js / Deno + Express - FastAPI provides higher performance due to its async capabilities

2. Django - FastAPI is more lightweight and faster. Django would be overkill for this project