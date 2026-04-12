---
title: Project Structure
---

## 📁 Project Structure

This project is organized into a modular monorepo format with separate folders for the backend, frontend, documentation, and configuration. Below is an overview of the core structure:

### 🗂️ Root Directory

```bash
/
├── .github/              # GitHub workflows and actions
├── .husky/               # Git hooks for pre-commit/CI setup
├── backend/              # Backend source code (Node.js + TypeScript)
├── docs/                 # Documentation site (Docusaurus)
├── frontend/             # Frontend codebase (React/Next.js/etc.)
├── .gitignore            # Git ignored files
├── package.json          # Project metadata and scripts
├── pnpm-lock.yaml        # Lockfile for deterministic installs
├── setup.py              # (Setup script)
```

---

### 🔙 Backend Structure (`/backend`)

The backend is written in **TypeScript** using **TypeDI** for dependency injection and **routing-controllers** for routing. It follows a modular domain-based architecture.

```
/backend
└── src/
    ├── config/               # App-wide configuration files
    │   ├── app.ts            # Express app initialization
    │   ├── db.ts             # Database connection logic
    │   └── sentry.ts         # Sentry error tracking setup

    ├── modules/              # Domain-based modules
    │   ├── auth/             # Authentication module
    │   └── courses/          # Courses module (feature-driven)
    │       ├── classes/         # DTOs using class-validator & class-transformer
    │       ├── controllers/     # API controllers using routing-controllers
    │       ├── utils/           # Course-specific utility functions
    │       ├── tests/           # Unit/integration tests for courses
    │       └── index.ts         # Module entry point for registration

    ├── shared/               # Reusable logic across modules
    │   ├── constants/        # Application-wide static constants
    │   ├── database/         # Shared database helpers and logic
    │   ├── errors/           # Custom error classes and handlers
    │   ├── functions/        # General reusable utility functions
    │   ├── interfaces/       # Common TypeScript interfaces and types
    │   ├── middleware/       # Express and TypeDI middlewares
    │   └── types.ts          # Global type definitions

    ├── utils/                # Global utility helpers
    │   ├── env.ts            # Load and validate environment variables
    │   ├── to-bool.ts        # Convert values to boolean
    │   └── index.ts          # Utility exports entrypoint

    └── tests/                # Global or shared test logic

```

- **`classes/`**: Defines request DTOs using `class-validator` and `class-transformer` for validation and transformation.
- **`controllers/`**: Contains route handlers decorated using `@Controller`, `@Post`, etc.
- **`utils/`**: Module-specific helper logic.
- **`shared/`**: Centralized helpers, middleware, interfaces, and constants reused across modules.

---

This structure promotes **separation of concerns**, **testability**, and **code reusability**, making it scalable for large codebases.


---

### 🔍 Notes

- **Modular Structure**: Each module inside `src/modules/` may/may not be independent and may contain its own controllers, services, routes, and DB access logic.
- **Shared Layer**: All cross-cutting concerns (like database, error handling, interfaces) are located inside `src/shared/` for reuse.
- **TypeDI & Routing-controllers**: Dependency injection and route handling are managed via `TypeDI` and `routing-controllers`.

