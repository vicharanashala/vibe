# ViBe Backend

## Overview

ViBe is a modular, scalable backend built with **TypeScript**, **Express**, **MongoDB**, and **InversifyJS** for dependency injection. It powers the ViBe platform, supporting authentication, course management, quizzes, anomaly detection, notifications, user progress, and more.

## Architecture

- **Express**: Main web server, with modular routing via `routing-controllers`.
- **InversifyJS**: Dependency injection for services, repositories, and controllers.
- **MongoDB**: Primary database, accessed via repository pattern.
- **Sentry**: Error monitoring and profiling.
- **Firebase**: Authentication and user management.
- **OpenAPI**: Auto-generated API documentation via Scalar.

## Main Features

- **Authentication**: Firebase-based, with JWT support and user management.
- **Courses**: CRUD for courses, versions, modules, sections, and items (video, quiz, blog).
- **Quizzes**: Question banks, quiz attempts, grading, and settings.
- **Users**: Enrollment, progress tracking, watch time, and anomaly detection.
- **Notifications**: Invites, email notifications, and status tracking.
- **Settings**: Proctoring and custom settings for users/courses.
- **Anomalies**: Detection and monitoring for user/course anomalies.
- **GenAI**: Integration for generative AI features.
- **API Reference**: `/reference` endpoint for live OpenAPI docs.

## Directory Structure


```
backend/
├── plop-templates/         # Code generation templates
│   ├── controller.hbs
│   ├── repository.hbs
│   ├── service.hbs
│   └── module-base/
│       ├── container.ts.hbs
│       ├── index.ts.hbs
│       └── types.ts.hbs
├── src/                    # Main source code
│   ├── bootstrap/          # Module loader and startup logic
│   │   └── loadModules.ts
│   ├── config/             # App and DB configuration
│   │   ├── ai.ts
│   │   ├── app.ts
│   │   ├── db.ts
│   │   ├── index.ts
│   │   ├── sentry.ts
│   │   ├── smtp.ts
│   │   └── storage.ts
│   ├── container.ts        # Inversify DI container setup
│   ├── index.ts            # Main entry point
│   ├── instrument.ts       # Sentry instrumentation
│   ├── inversify-adapter.ts# Inversify adapter for routing-controllers
│   ├── modules/            # Main business logic, organized by domain
│   │   ├── anomalies/
│   │   ├── auth/
│   │   ├── courses/
│   │   ├── genAI/
│   │   ├── notifications/
│   │   ├── quizzes/
│   │   ├── settings/
│   │   └── users/
│   ├── shared/             # Common code (classes, interfaces, db, middleware, etc.)
│   │   ├── classes/
│   │   ├── constants/
│   │   ├── database/
│   │   ├── functions/
│   │   ├── interfaces/
│   │   └── middleware/
│   ├── types.ts            # Global type symbols for DI
│   └── utils/              # Utility functions
│       ├── env.ts
│       ├── index.ts
│       ├── logDetails.ts
│       └── to-bool.ts
├── .env                    # Environment variables (not committed)
├── .example.env            # Example env file
├── Dockerfile              # Docker setup for deployment
├── Dockerfile-all          # Docker setup for all-in-one deployment
├── firebase.json           # Firebase config
├── package.json            # Project metadata and dependencies
├── plopfile.cjs            # Plop code generator config
├── tsconfig.json           # TypeScript config
├── typedoc.json            # Typedoc config for API docs
├── vite.config.ts          # Vite config (if used for frontend)
└── README.md               # Project documentation
```

## Key Modules

- **Auth**: FirebaseAuthService for signup, login, password change, and token verification.
- **Courses**: CourseRepository for managing courses, versions, modules, sections, and items.
- **Quizzes**: Quiz logic, question types (SOL, SML, MTL, OTL, NAT, DES), and grading.
- **Users**: EnrollmentService and ProgressService for tracking user progress and enrollments.
- **Notifications**: InviteRepository and MailService for sending and managing invites.
- **Settings**: SettingsRepository for proctoring and custom settings.
- **Anomalies**: User anomaly tracking and reporting.

## Module Details

- **Anomalies**: Detects and tracks user/course anomalies for monitoring and security.
- **Auth**: Handles user authentication, signup, login, password management, and token verification using Firebase.
- **Courses**: Manages courses, versions, modules, sections, and items (video, quiz, blog).
- **GenAI**: Integrates generative AI features (details depend on implementation).
- **Notifications**: Manages invites, email notifications, and status tracking.
- **Quizzes**: Handles question banks, quiz attempts, grading, and quiz settings. Supports multiple question types (SOL, SML, MTL, OTL, NAT, DES).
- **Settings**: Manages proctoring and custom settings for users and courses.
- **Users**: Tracks enrollments, progress, watch time, and user-specific data.

## Shared Layer

- **Classes**: Base service classes, utility classes.
- **Constants**: Shared constants for configuration and logic.
- **Database**: MongoDB connection, repositories, and interfaces for CRUD operations.
- **Functions**: Utility functions (OpenAPI spec generation, authorization, current user checker, etc.).
- **Interfaces**: TypeScript interfaces for models, DTOs, and contracts.
- **Middleware**: Express middleware for logging, error handling, etc.

## Utilities

- **env.ts**: Loads environment variables.
- **logDetails.ts**: Prints startup summary and route table.
- **to-bool.ts**: Utility for boolean conversion.

## Scripts

- **generate-openapi.cjs**: Generates OpenAPI spec from codebase.
- **class-transformer-0.5.1.patch.js**: Patch for class-transformer compatibility.
- **start.sh**: Startup script for server.

## Plop Templates

- Used for scaffolding new modules, controllers, services, and repositories.

## Build Output

- All compiled JS files are placed in the `build/` directory. Do not edit these directly.

## Environment Variables

- See `.example.env` for all required variables.
- Sensitive values (DB, Firebase, Sentry, etc.) should be set in `.env`.
- For real email delivery, set `SMTP_USER` and `SMTP_PASS` in `.env`.
- Gmail requires an App Password, not your normal account password.
- You can keep `SMTP_SERVICE="gmail"` for Gmail, or set `SMTP_HOST` / `SMTP_PORT` / `SMTP_SECURE` for another SMTP provider.

## API Reference

- Auto-generated OpenAPI docs available at `/reference` after starting the server.

## Error Handling & Logging

- **Sentry**: Integrated for error tracking in production/staging.
- **Custom Middleware**: Logging of requests, responses, and errors.
- **Startup Summary**: Prints environment, routes, and config on boot.

## Testing

- Uses `vitest` for unit and integration tests.
- Run tests with `pnpm test`.

## Deployment

- Dockerfiles provided for containerized deployment.
- Sentry integration for error monitoring in production/staging.

## Extending

- Add new modules in `src/modules/`
- Register controllers, services, and repositories in the module's `index.ts`
- Use dependency injection via Inversify

## Technologies Used

- TypeScript, Express, MongoDB, InversifyJS, Firebase Admin, Sentry, Scalar, Chalk, Console Table Printer, Routing Controllers, Class Validator/Transformer

## Contributing

- See code comments and module structure for guidance. Use plop templates for scaffolding new controllers, services, and repositories.

---

For more details, see the codebase and module documentation.
