# ViBe Platform - Formal Specifications Document

**Version:** 1.0.0  
**Date:** April 28, 2026  
**Status:** Complete Specifications  
**License:** MIT

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [System Overview](#system-overview)
3. [Architecture](#architecture)
4. [Technology Stack](#technology-stack)
5. [Project Structure](#project-structure)
6. [Component Specifications](#component-specifications)
7. [Module Specifications](#module-specifications)
8. [Database Specifications](#database-specifications)
9. [Configuration & Environment](#configuration--environment)
10. [Build Process](#build-process)
11. [Deployment Architecture](#deployment-architecture)
12. [API Specifications](#api-specifications)
13. [Security Specifications](#security-specifications)
14. [Testing Architecture](#testing-architecture)
15. [Development Workflow](#development-workflow)
16. [Maintenance & Operations](#maintenance--operations)

---

## Executive Summary

ViBe is an innovative educational platform designed to enhance learning through continuous assessment and interactive challenges. The platform implements adaptive learning mechanisms, smart question generation, and AI-driven proctoring to ensure student mastery of course material before progression.

### Key Characteristics:
- **Type:** Full-stack web application (MERN variant)
- **Primary Language:** TypeScript
- **Architecture Pattern:** Modular, layered microservices-ready architecture
- **Database:** MongoDB (NoSQL document store)
- **Deployment:** Multi-environment (development, staging, production)
- **Scale:** Enterprise-grade educational platform

---

## System Overview

### Platform Purpose
ViBe serves as a comprehensive learning management system with the following core functions:

1. **Learning Content Management** - Course creation, versioning, and management
2. **Assessment & Evaluation** - Quiz creation, adaptive question generation, grading
3. **Progress Tracking** - Student enrollment, progress monitoring, achievement tracking
4. **Integrity Assurance** - AI-powered proctoring, anomaly detection, engagement verification
5. **User Management** - Authentication, authorization, role-based access control
6. **Communication** - Notifications, invitations, status tracking
7. **Analytics & Reporting** - Course analytics, student performance metrics

### System Scope

**In Scope:**
- Backend API server with full CRUD operations
- Frontend web application with responsive UI
- Database management and persistence
- Authentication and authorization
- Automated testing (unit and E2E)
- Cloud deployment infrastructure
- Documentation generation

**Out of Scope:**
- Mobile native applications (web-responsive only)
- Real-time video streaming (references external media)
- Real-time WebSocket communication (HTTP-based for now)

### Stakeholder Interfaces

| Stakeholder | Interface | Access Type |
|------------|-----------|-------------|
| Students | Web Frontend | HTTP/HTTPS |
| Instructors | Web Frontend + Admin Dashboard | HTTP/HTTPS |
| Administrators | Backend Admin Console | HTTP/HTTPS API |
| External Services | REST API | OAuth/JWT tokens |

---

## Architecture

### High-Level Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                      Presentation Layer                      │
│                   (Frontend - React + Vite)                  │
│              Public SPA @ http://localhost:5173              │
└───────────────────────┬─────────────────────────────────────┘
                        │
                    HTTP/HTTPS
                        │
┌───────────────────────▼─────────────────────────────────────┐
│                      API Gateway                              │
│              (Express.js, Port 8080 / 4001)                  │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Middleware Layer:                                   │   │
│  │  - CORS Handler                                      │   │
│  │  - Authentication (JWT/Firebase)                     │   │
│  │  - Error Handling                                    │   │
│  │  - Rate Limiting                                     │   │
│  │  - Logging & Instrumentation (Sentry)               │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Routing & Controllers (Routing Controllers)         │   │
│  │  - Auth Controller                                   │   │
│  │  - Courses Controller                                │   │
│  │  - Quizzes Controller                                │   │
│  │  - Users Controller                                  │   │
│  │  - Notifications Controller                          │   │
│  │  - Settings Controller                               │   │
│  │  - Anomalies Controller                              │   │
│  │  - GenAI Controller                                  │   │
│  └──────────────────────────────────────────────────────┘   │
└───────────────────────┬─────────────────────────────────────┘
                        │
        ┌───────────────┼───────────────┐
        │               │               │
        ▼               ▼               ▼
    ┌────────┐  ┌────────────┐  ┌──────────────┐
    │MongoDB │  │ Firebase   │  │Google Cloud  │
    │Database│  │Auth/       │  │Storage       │
    │        │  │Firestore   │  │(GCS Buckets) │
    └────────┘  └────────────┘  └──────────────┘
        │
    ┌───▼────────────────────────────────────┐
    │     External Services Layer             │
    │  - Anthropic AI API (genAI)            │
    │  - SMTP Service (Notifications)        │
    │  - Sentry (Error Tracking)             │
    │  - AI Server (Anomaly Detection)       │
    └─────────────────────────────────────────┘
```

### Architectural Patterns

#### 1. **Modular Monolith Pattern**
- Application organized as independent modules
- Each module has controllers, services, repositories
- Modules can be deployed individually or together
- Dependency injection via InversifyJS enables loose coupling

#### 2. **Repository Pattern**
- Data access abstraction layer
- All database queries flow through repository classes
- Enables testing with mock repositories

#### 3. **Service Layer Pattern**
- Business logic encapsulated in service classes
- Services call repositories for data access
- Controllers delegate to services

#### 4. **Dependency Injection Pattern**
- InversifyJS manages service dependencies
- Container resolution at application startup
- Automatic injection into controllers and services

#### 5. **Event-Driven Patterns** (Planned)
- Event emission for state changes
- Decoupled components via events
- Asynchronous processing of secondary actions

### Layered Architecture

```
┌──────────────────────────────────────┐
│    Controllers (HTTP Entry Points)    │
│    - Route handling                   │
│    - Request validation               │
│    - Response formatting              │
└──────────────────────┬────────────────┘
                       │
┌──────────────────────▼────────────────┐
│    Service Layer (Business Logic)      │
│    - Data transformation               │
│    - Business rules                    │
│    - Complex operations                │
└──────────────────────┬────────────────┘
                       │
┌──────────────────────▼────────────────┐
│   Repository Layer (Data Access)      │
│    - Database queries                  │
│    - Data persistence                  │
│    - Query abstraction                 │
└──────────────────────┬────────────────┘
                       │
┌──────────────────────▼────────────────┐
│    MongoDB (Data Persistence)         │
│    - Document storage                  │
│    - Indexing                          │
│    - Transactions                      │
└──────────────────────────────────────┘
```

---

## Technology Stack

### Backend Stack

| Category | Technology | Version | Purpose |
|----------|-----------|---------|---------|
| **Runtime** | Node.js | 22 LTS | JavaScript runtime environment |
| **Language** | TypeScript | 5.9.3 | Type-safe JavaScript |
| **Web Framework** | Express.js | Latest | HTTP server and routing |
| **Routing** | routing-controllers | Latest | Decorator-based routing |
| **DI Container** | InversifyJS | 6.x | Dependency injection |
| **Database Driver** | MongoDB Driver | Latest | Native MongoDB connectivity |
| **Async Processing** | Node.js Built-in | N/A | Async/await, Promises |
| **Testing** | Vitest | 3.2.3 | Unit and integration testing |
| **Code Coverage** | Vitest Coverage | 3.2.3 | Code coverage reporting |
| **Code Linting** | GTS (Google TS Style) | 6.0.2 | Code quality and style |
| **Error Tracking** | Sentry | 9.30.0 | Error monitoring and APM |
| **Validation** | class-validator | Latest | Data validation |
| **Transformation** | class-transformer | 0.5.1 | Data transformation |
| **AI Integration** | Anthropic SDK | 0.71.2 | Generative AI features |
| **Cloud Storage** | Google Cloud Storage | 7.17.1 | Media and backup storage |
| **Authentication** | Firebase Auth | Native | User authentication |
| **Email** | SMTP (Nodemailer) | Custom | Email notifications |
| **Build Tool** | SWC | 1.5.4 | Fast TypeScript compilation |
| **Code Generation** | Plop | 4.0.1 | Scaffolding templates |
| **Documentation** | TypeDoc | 0.28.2 | API documentation |

### Frontend Stack

| Category | Technology | Version | Purpose |
|----------|-----------|---------|---------|
| **Framework** | React | 18.x | UI library |
| **Build Tool** | Vite | Latest | Fast dev server and build |
| **Language** | TypeScript | 5.x | Type-safe JavaScript |
| **Styling** | Tailwind CSS | Latest | Utility-first CSS |
| **UI Components** | shadcn/ui | Latest | Pre-built accessible components |
| **Icons** | Tabler Icons | 3.33.0 | Icon library |
| **State Management** | TanStack Query | 5.66.7 | Server state management |
| **Routing** | TanStack Router | 1.120.5 | Type-safe routing |
| **Tables** | TanStack Table | 8.21.3 | Advanced data tables |
| **HTTP Client** | Fetch API | Native | HTTP requests |
| **Form Handling** | React JSON Schema Form | 6.0.0-beta.10 | Dynamic form generation |
| **Drag & Drop** | dnd-kit | 6.3.1 | Drag and drop utilities |
| **Media Detection** | Mediapipe | Latest | Face detection, pose estimation |
| **Face Recognition** | TensorFlow.js | 4.22.0 | ML in browser |
| **Proctoring** | Custom Implementation | N/A | Engagement verification |
| **PDF Generation** | React-PDF | 4.3.0 | PDF export |
| **Excel Export** | XLSX | Latest | Spreadsheet export |
| **Testing** | Playwright | Latest | E2E testing |
| **Linting** | GTS | 6.x | Code quality |

### Database (MongoDB)

| Aspect | Specification |
|--------|---------------|
| **Type** | Document-based NoSQL |
| **Connection String Format** | `mongodb://[user[:password]@]host[:port][,host[:port],...]/[database]` |
| **Default Database** | `vibe` |
| **Driver** | MongoDB Node.js Driver (native) |
| **Collections** | Dynamic (created per module) |
| **Indexing** | Database-level indexing on frequently queried fields |
| **Transactions** | Multi-document transactions supported |
| **Backup** | Google Cloud Storage (GCS) |

### External Services

| Service | Purpose | Authentication |
|---------|---------|-----------------|
| **Firebase Auth** | User authentication and token verification | API Key + Private Key |
| **Google Cloud Storage** | Media storage, backups, anomaly data | Service Account JSON |
| **Anthropic API** | Generative AI (question generation, etc.) | API Key |
| **SMTP Service** | Email notifications | Credentials in config |
| **Sentry** | Error tracking and APM | DSN |

---

## Project Structure

### Repository Root Structure

```
vibe/
├── .github/                    # GitHub workflows and CI/CD
├── .husky/                     # Git hooks for linting
├── .firebase/                  # Firebase configuration
├── backend/                    # Backend server
├── frontend/                   # React frontend application
├── cli/                        # Command-line interface for development
├── mcp/                        # Model Context Protocol server (future)
├── docs/                       # Docusaurus documentation site
├── e2e/                        # Playwright E2E tests
├── scripts/                    # Root-level setup and utility scripts
├── public/                     # Static public assets
├── package.json               # Root workspace package.json
├── pnpm-workspace.yaml        # pnpm monorepo configuration
├── pnpm-lock.yaml             # Dependency lock file
├── firebase.json              # Firebase hosting configuration
├── setup.py                   # Python setup for AI components
├── convert_*.py               # Model conversion scripts (ONNX)
├── EMOTION_*.md               # Emotion tracking documentation
├── FINAL_INTEGRATION_*.md     # Integration checklists
├── LICENSE                    # MIT License
└── README.md                  # Project overview
```

### Backend Structure (`backend/`)

```
backend/
├── src/                       # TypeScript source code
│   ├── bootstrap/
│   │   └── loadModules.ts     # Dynamic module loader
│   ├── config/                # Configuration files
│   │   ├── ai.ts              # AI service configuration
│   │   ├── app.ts             # App configuration
│   │   ├── db.ts              # Database configuration
│   │   ├── sentry.ts          # Error tracking configuration
│   │   ├── smtp.ts            # Email service configuration
│   │   ├── storage.ts         # Cloud storage configuration
│   │   └── index.ts
│   ├── modules/               # Business logic modules
│   │   ├── announcements/     # Course announcements
│   │   ├── anomalies/         # Anomaly detection and reporting
│   │   ├── auditTrails/       # Audit logging
│   │   ├── auth/              # Authentication (Firebase)
│   │   ├── courseRegistration/# Enrollment management
│   │   ├── courses/           # Course management
│   │   ├── ejectionPolicy/    # Course ejection rules
│   │   ├── emotions/          # Emotion tracking and analysis
│   │   ├── genAI/             # Generative AI integration
│   │   ├── hpSystem/          # HP (Hp Points?) system
│   │   ├── notifications/     # Email and in-app notifications
│   │   ├── projects/          # Student projects
│   │   ├── quizzes/           # Quiz management and grading
│   │   ├── reports/           # Report generation
│   │   ├── setting/           # User settings
│   │   └── users/             # User management and profiles
│   │
│   │   Each module has structure:
│   │   module-name/
│   │   ├── index.ts           # Exports and setup
│   │   ├── container.ts       # DI container binding
│   │   ├── types.ts           # TypeScript types/interfaces
│   │   ├── controllers/       # HTTP route handlers
│   │   ├── services/          # Business logic
│   │   ├── repositories/      # Data access layer
│   │   ├── validators/        # Request validators
│   │   ├── entities/          # TypeORM entities (if used)
│   │   └── tests/             # Module tests
│   │
│   ├── shared/                # Common code
│   │   ├── classes/           # Base classes (BaseController, etc.)
│   │   ├── constants/         # Application constants
│   │   ├── database/          # MongoDB connection and utilities
│   │   ├── functions/         # Helper functions
│   │   ├── interfaces/        # Common interfaces
│   │   ├── middleware/        # Express middleware
│   │   └── utils/
│   │
│   ├── utils/                 # Utility functions
│   │   ├── env.ts             # Environment variable loading
│   │   ├── logDetails.ts      # Startup logging
│   │   └── startCron.ts       # Scheduled tasks
│   │
│   ├── workers/               # Background workers
│   ├── container.ts           # Root DI container setup
│   ├── index.ts               # Application entry point
│   ├── instrument.ts          # Sentry instrumentation
│   ├── inversify-adapter.ts   # Inversify adapter for routing-controllers
│   └── types.ts               # Global type symbols for DI
│
├── build/                     # Compiled JavaScript (generated)
│   ├── index.js
│   ├── container.js
│   ├── bootstrap/
│   ├── config/
│   ├── modules/
│   ├── shared/
│   ├── utils/
│   └── workers/
│
├── plop-templates/            # Code generation templates
│   ├── controller.hbs
│   ├── repository.hbs
│   ├── service.hbs
│   └── module-base/
│       ├── container.ts.hbs
│       ├── index.ts.hbs
│       └── types.ts.hbs
│
├── scripts/                   # Build and utility scripts
│   ├── class-transformer-0.5.1.patch.js
│   ├── generate-openapi.cjs   # OpenAPI spec generator
│   └── start.sh               # Start script for Docker
│
├── tests/                     # Integration tests
├── Dockerfile                 # Production Docker image
├── Dockerfile-all             # All-in-one Docker image
├── firebase.json              # Firebase config
├── package.json               # Dependencies and scripts
├── plopfile.cjs               # Code generator configuration
├── tsconfig.json              # TypeScript configuration
├── typedoc.json               # API documentation config
├── vite.config.ts             # Vitest configuration
├── .env                       # Environment variables (not committed)
├── .env.example               # Template for environment variables
└── README.md                  # Backend documentation
```

### Frontend Structure (`frontend/`)

```
frontend/
├── src/
│   ├── app/                   # Main application entry
│   │   ├── App.tsx
│   │   └── index.tsx
│   │
│   ├── components/            # Reusable React components
│   │   ├── ui/                # shadcn/ui components
│   │   ├── layout/            # Layout components
│   │   ├── common/            # Common UI components
│   │   └── ...
│   │
│   ├── layouts/               # Page layout components
│   │   ├── MainLayout.tsx
│   │   ├── AuthLayout.tsx
│   │   └── ...
│   │
│   ├── hooks/                 # Custom React hooks
│   │   ├── useAuth.ts
│   │   ├── useQuery.ts
│   │   └── ...
│   │
│   ├── lib/                   # Library code and utilities
│   │   ├── api/
│   │   │   ├── client.ts      # API client setup
│   │   │   └── schema.ts      # Generated OpenAPI schema
│   │   ├── utils/             # Utility functions
│   │   └── ...
│   │
│   ├── store/                 # State management (TanStack Query)
│   │   ├── queries/           # React Query hooks
│   │   └── mutations/         # React Query mutations
│   │
│   ├── types/                 # TypeScript type definitions
│   │   ├── api.ts             # API types
│   │   ├── models.ts          # Data model types
│   │   └── ...
│   │
│   ├── assets/                # Static assets
│   │   ├── img/
│   │   ├── fonts/
│   │   └── ...
│   │
│   ├── styles/                # Global styles
│   │   └── globals.css
│   │
│   ├── workers/               # Web Workers
│   │   └── ...
│   │
│   └── vite-env.d.ts          # Vite environment types
│
├── public/                    # Static public files
│   ├── img/
│   └── ...
│
├── scripts/                   # Build and utility scripts
│   └── deploy.sh
│
├── dist/                      # Build output (generated)
├── index.html                 # HTML entry point
├── nginx.conf                 # Nginx configuration (Docker)
├── Dockerfile                 # Docker image for frontend
├── package.json               # Dependencies and scripts
├── tsconfig.json              # TypeScript configuration
├── tsconfig.app.json          # App-specific TS config
├── tsconfig.node.json         # Node-specific TS config
├── vite.config.ts             # Vite build configuration
├── postcss.config.js          # PostCSS configuration
├── eslint.config.js           # ESLint configuration
├── components.json            # Shadcn/ui configuration
├── openapi.json               # Generated OpenAPI spec
├── firebase.json              # Firebase config
└── README.md                  # Frontend documentation
```

### CLI Structure (`cli/`)

```
cli/
├── src/
│   ├── cli.ts                 # CLI entry point
│   ├── findRoot.ts            # Project root detector
│   ├── commands/              # CLI commands
│   │   ├── start.ts           # Start dev servers
│   │   ├── test.ts            # Run tests
│   │   ├── help.ts            # Help command
│   │   └── setup.ts           # Setup command
│   └── steps/                 # Setup steps
│
├── templates/                 # Template files
└── package.json               # Dependencies
```

### E2E Testing Structure (`e2e/`)

```
e2e/
├── tests/                     # Test files
│   ├── common-utils.ts        # Shared test utilities
│   └── ...
│
├── assets/                    # Test assets
│   ├── webcam-face.y4m        # Fake video for testing
│   ├── webcam-face.wav        # Fake audio for testing
│   └── ...
│
├── test-results/              # Test execution results
│   └── ...
│
├── playwright.config.ts       # Playwright configuration
├── package.json               # Dependencies
└── README.md                  # E2E testing documentation
```

---

## Component Specifications

### 1. Express.js Server

**Configuration:**
- **Port:** Configurable via `APP_PORT` or `PORT` env var (default: 8080)
- **Trust Proxy:** Enabled (`app.set('trust proxy', 1)`)
- **CORS:** Configured for multiple origins

**Middleware Stack:**
1. Logging Handler (`loggingHandler`)
2. Global Rate Limiter (`createRateLimiter`)
3. Routing Controllers middleware
4. HTTP Error Handler

**Features:**
- RESTful API with routing-controllers decorators
- OpenAPI/Swagger documentation at `/reference`
- Health check endpoint at `/health`
- Comprehensive error handling

### 2. MongoDB Connection

**Connection Management:**
```typescript
// Configuration from config/db.ts
{
  url: string,      // MongoDB connection URL
  dbName: string    // Database name (default: "vibe")
}
```

**Database Operations:**
- Connection pooling (managed by MongoDB driver)
- Document-based operations
- Indexing for performance
- Multi-document transactions

**Collections:**
- Dynamic creation per module
- No enforced schema (flexible documents)
- TTL indexes for temporary data

### 3. Authentication & Authorization

**Authentication Methods:**
1. **Firebase Authentication** - Primary auth mechanism
   - Sign up with email/password
   - Social login (Google, etc.)
   - JWT token generation and validation

2. **JWT Tokens**
   - Bearer token in Authorization header
   - Token verification on protected routes
   - Expiration handling

**Authorization:**
- Role-Based Access Control (RBAC)
- @casl/ability for permission checking
- Decorator-based authorization on controllers
- `currentUserChecker` middleware extracts user context

**User Roles:**
- `student` - Access to courses and quizzes
- `instructor` - Course creation and management
- `admin` - Full platform access
- `superadmin` - System configuration access

### 4. File Storage System

**Cloud Storage (Google Cloud Storage):**
```typescript
{
  projectId: string,
  anomalyBucketName: string,     // "vibe-anomaly-data"
  facesBucketName: string,       // "vibe-faces-data"
  aiServerBucketName: string,    // "vibe-aiserver-data"
  mediaEncryptionKey: string     // Encryption key
}
```

**Buckets:**
- `vibe-anomaly-data` - Anomaly detection records
- `vibe-faces-data` - Face detection results
- `vibe-aiserver-data` - AI model data and outputs

**File Operations:**
- Upload with encryption
- Managed access control
- Automatic cleanup (TTL policies)

### 5. Dependency Injection Container (InversifyJS)

**Container Setup:**
```typescript
// Configured in src/container.ts
// Loaded via bootstrap/loadModules.ts
```

**Binding Types:**
- Services (singletons)
- Repositories (singletons)
- Controllers (transient)
- Validators (transient)

**Module Registration:**
- Each module defines a `ContainerModule`
- Container loads modules at startup
- Adaptor pattern for routing-controllers integration

### 6. Error Handling & Monitoring

**Sentry Integration:**
- Automatic error capturing
- Performance monitoring (APM)
- Source map support
- Environment-based filtering

**Error Handler Middleware:**
- Catches unhandled exceptions
- Formats error responses
- Logs to Sentry
- Returns appropriate HTTP status codes

**Logging:**
- Morgan-based request logging
- Structured logging support
- Log levels (debug, info, warn, error)

---

## Module Specifications

### Auth Module

**Purpose:** User authentication and token management

**Exports:**
```typescript
authModuleControllers[]     // Controllers
authModuleValidators[]      // Validators
authContainerModules[]      // DI modules
```

**Key Controllers:**
- `AuthController` - Login, signup, password reset, token verification

**Key Services:**
- `FirebaseAuthService` - Firebase user management
- `TokenService` - JWT token handling

**Key Repositories:**
- `UserRepository` - User document access

**Endpoints:**
```
POST   /api/auth/signup
POST   /api/auth/login
POST   /api/auth/refresh-token
POST   /api/auth/verify-token
POST   /api/auth/password-reset
POST   /api/auth/change-password
```

### Courses Module

**Purpose:** Course creation, management, versioning

**Structure:**
- Courses have versions (for content updates)
- Versions contain modules (chapter-like groups)
- Modules contain sections
- Sections contain items (videos, quizzes, blogs)

**Key Repositories:**
- `CourseRepository`
- `CourseVersionRepository`
- `CourseModuleRepository`
- `CourseSectionRepository`
- `CourseItemRepository`

**Item Types:**
- `video` - Video content
- `quiz` - Quiz questions
- `blog` - Text content

**Endpoints:**
```
GET    /api/courses                    # List courses
POST   /api/courses                    # Create course
GET    /api/courses/:id                # Get course details
PUT    /api/courses/:id                # Update course
DELETE /api/courses/:id                # Delete course
GET    /api/courses/:id/versions       # List versions
POST   /api/courses/:id/versions       # Create version
GET    /api/courses/:id/modules        # List modules
POST   /api/courses/:id/modules        # Create module
# ... and many more for sections, items, etc.
```

### Quizzes Module

**Purpose:** Quiz creation, question management, grading

**Question Types:**
- `SOL` - Single Option (Multiple Choice)
- `SML` - Single Multiple-line
- `MTL` - Multi True/False Line
- `OTL` - One True/False Line
- `NAT` - Numerical Answer Type
- `DES` - Descriptive/Essay

**Key Entities:**
- `Quiz` - Quiz container
- `QuestionBank` - Question storage
- `QuizAttempt` - Student attempt tracking
- `QuestionResponse` - Student answer

**Grading:**
- Automatic grading for objective types
- Manual/rubric-based for descriptive
- Partial credit support

**Endpoints:**
```
GET    /api/quizzes                    # List quizzes
POST   /api/quizzes                    # Create quiz
GET    /api/quizzes/:id                # Get quiz
PUT    /api/quizzes/:id                # Update quiz
POST   /api/quizzes/:id/attempts       # Start attempt
POST   /api/quizzes/:id/submit         # Submit attempt
GET    /api/quizzes/:id/results        # Get results
POST   /api/quizzes/:id/questions      # Add questions
```

### Users Module

**Purpose:** User profiles, enrollment, progress tracking

**Key Repositories:**
- `UserRepository` - User profiles
- `EnrollmentRepository` - Course enrollment
- `ProgressRepository` - Course progress
- `WatchTimeRepository` - Video watch tracking

**User Profile Fields:**
- Basic info (name, email, photo)
- Role (student, instructor, admin)
- Organization/Institution
- Contact information
- Preferences

**Endpoints:**
```
GET    /api/users/:id                  # Get user profile
PUT    /api/users/:id                  # Update profile
GET    /api/users/:id/enrollments      # List enrollments
POST   /api/users/:id/enrollments      # Enroll in course
GET    /api/users/:id/progress         # Get progress
GET    /api/users/:id/watch-time       # Get watch time
```

### Notifications Module

**Purpose:** Email and in-app notifications, invitations

**Notification Types:**
- Course invitations
- Progress updates
- Assignment due notices
- Grading notifications
- System announcements

**Key Services:**
- `MailService` - Email sending via SMTP
- `NotificationService` - Notification management

**Key Repositories:**
- `NotificationRepository`
- `InviteRepository`

**Endpoints:**
```
POST   /api/notifications/send         # Send notification
GET    /api/notifications              # List notifications
PUT    /api/notifications/:id/read     # Mark as read
POST   /api/invites                    # Send invite
GET    /api/invites/:id                # Get invite
PUT    /api/invites/:id/accept         # Accept invite
```

### Settings Module

**Purpose:** User and course-level settings

**Setting Categories:**
- Proctoring settings
- Course-specific settings
- User preferences
- System settings

**Endpoints:**
```
GET    /api/settings                   # Get user settings
PUT    /api/settings                   # Update settings
GET    /api/courses/:id/settings       # Get course settings
PUT    /api/courses/:id/settings       # Update course settings
```

### Anomalies Module

**Purpose:** Anomaly detection and reporting for academic integrity

**Detection Types:**
- Unusual answer patterns
- Rapid completion times
- Copy-paste detection
- Engagement verification (face detection)
- Behavioral anomalies

**Key Repositories:**
- `AnomalyRepository`
- `AnomalyReportRepository`

**Endpoints:**
```
GET    /api/anomalies                  # List anomalies
POST   /api/anomalies/detect           # Trigger detection
GET    /api/anomalies/:id              # Get anomaly details
GET    /api/anomalies/:id/report       # Generate report
```

### GenAI Module

**Purpose:** Generative AI integration (question generation, content)

**Integration Points:**
- Anthropic API for question generation
- Content summarization
- Learning suggestions

**Key Services:**
- `AIService` - AI API interactions
- `QuestionGenerationService` - Generates quiz questions

**Configuration:**
```typescript
{
  serverIP: string,           // AI server IP
  serverPort: number,         // AI server port (9017)
  proxyAddress: string,       // SOCKS5 proxy
  ANTHROPIC_CRED: string,     // API key
  ANTHROPIC_MODEL: string     // Model name
}
```

### Announcements Module

**Purpose:** Course-wide announcements and updates

**Endpoints:**
```
GET    /api/announcements              # List announcements
POST   /api/announcements              # Create announcement
GET    /api/announcements/:id          # Get announcement
PUT    /api/announcements/:id          # Update announcement
DELETE /api/announcements/:id          # Delete announcement
```

### Additional Modules

- **auditTrails** - Audit logging for compliance
- **courseRegistration** - Advanced enrollment features
- **ejectionPolicy** - Rules for removing students
- **emotions** - Emotion tracking during assessment
- **hpSystem** - Gamification/points system
- **projects** - Student project submissions
- **reports** - Analytics and reporting

---

## Database Specifications

### Schema Design

#### User Document Structure

```javascript
{
  _id: ObjectId,
  firebaseId: String,          // Firebase UID
  email: String,               // Email address
  name: String,                // Full name
  profilePicture: String,      // URL to profile image
  role: String,                // "student", "instructor", "admin"
  institution: String,         // Organization name
  phone: String,               // Contact number
  preferences: {
    theme: String,             // "light", "dark"
    notifications: Boolean,
    language: String
  },
  createdAt: Date,
  updatedAt: Date
}
```

#### Course Document Structure

```javascript
{
  _id: ObjectId,
  title: String,
  description: String,
  instructor: ObjectId,        // Reference to User
  category: String,
  thumbnail: String,           // Cover image URL
  totalModules: Number,
  totalItems: Number,
  status: String,              // "draft", "published", "archived"
  settings: {
    enableProctoring: Boolean,
    allowFastCompletion: Boolean,
    requireAuthentication: Boolean
  },
  tags: [String],
  createdAt: Date,
  updatedAt: Date,
  versions: [ObjectId]         // Array of CourseVersion IDs
}
```

#### Quiz Document Structure

```javascript
{
  _id: ObjectId,
  course: ObjectId,            // Reference to Course
  title: String,
  description: String,
  section: ObjectId,           // Reference to CourseSection
  totalQuestions: Number,
  duration: Number,            // Minutes
  passingScore: Number,        // Percentage
  settings: {
    randomizeQuestions: Boolean,
    allowReview: Boolean,
    showAnswerAtEnd: Boolean,
    maxAttempts: Number
  },
  questions: [ObjectId],       // Array of Question IDs
  createdAt: Date,
  updatedAt: Date
}
```

#### Question Document Structure

```javascript
{
  _id: ObjectId,
  quiz: ObjectId,              // Reference to Quiz
  type: String,                // "SOL", "SML", "MTL", "OTL", "NAT", "DES"
  question: String,            // Question text
  options: [
    {
      _id: ObjectId,
      text: String,
      correct: Boolean
    }
  ],
  answer: String,              // Correct answer
  explanation: String,         // Explanation for answer
  difficulty: String,          // "easy", "medium", "hard"
  marks: Number,
  createdAt: Date,
  updatedAt: Date
}
```

#### Enrollment Document Structure

```javascript
{
  _id: ObjectId,
  user: ObjectId,              // Reference to User
  course: ObjectId,            // Reference to Course
  enrollmentDate: Date,
  status: String,              // "active", "completed", "dropped"
  progress: {
    itemsCompleted: Number,
    totalItems: Number,
    percentageComplete: Number,
    lastAccessedAt: Date
  },
  grades: {
    totalScore: Number,
    totalEarned: Number,
    percentageScore: Number
  },
  completedAt: Date
}
```

#### QuizAttempt Document Structure

```javascript
{
  _id: ObjectId,
  quiz: ObjectId,              // Reference to Quiz
  user: ObjectId,              // Reference to User
  startTime: Date,
  endTime: Date,
  status: String,              // "in-progress", "submitted", "graded"
  score: Number,
  totalMarks: Number,
  responses: [
    {
      _id: ObjectId,
      question: ObjectId,
      answer: String,
      correct: Boolean,
      marksObtained: Number
    }
  ],
  anomalies: [ObjectId]        // References to detected anomalies
}
```

#### Anomaly Document Structure

```javascript
{
  _id: ObjectId,
  type: String,                // "pattern", "speed", "plagiarism", "engagement"
  user: ObjectId,              // Reference to User
  quiz: ObjectId,              // Reference to Quiz
  severity: String,            // "low", "medium", "high"
  details: Object,             // Type-specific details
  resolved: Boolean,
  report: ObjectId,            // Reference to AnomalyReport
  detectedAt: Date,
  resolvedAt: Date
}
```

### Indexing Strategy

**Primary Indexes:**
```javascript
// Users
db.users.createIndex({ email: 1 }, { unique: true })
db.users.createIndex({ firebaseId: 1 }, { unique: true })

// Courses
db.courses.createIndex({ instructor: 1 })
db.courses.createIndex({ status: 1 })

// Enrollments
db.enrollments.createIndex({ user: 1, course: 1 }, { unique: true })
db.enrollments.createIndex({ user: 1 })
db.enrollments.createIndex({ course: 1 })

// Quiz Attempts
db.quizzAttempts.createIndex({ user: 1, quiz: 1 })
db.quizzAttempts.createIndex({ user: 1 })
db.quizzAttempts.createIndex({ quiz: 1 })

// Anomalies
db.anomalies.createIndex({ user: 1 })
db.anomalies.createIndex({ quiz: 1 })
db.anomalies.createIndex({ severity: 1 })
```

**Performance Indexes:**
```javascript
// Frequently queried fields
db.courses.createIndex({ createdAt: -1 })
db.enrollments.createIndex({ enrollmentDate: -1 })

// TTL Indexes (auto-delete expired documents)
db.sessions.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 })
```

### Data Consistency & Validation

**Application-Level Validation:**
- All controllers use validators
- Schema validation with `class-validator`
- TypeScript strict mode for compile-time checking

**Database-Level Constraints:**
- Unique indexes on critical fields
- Reference integrity (handled in application layer)
- TTL indexes for temporary data cleanup

---

## Configuration & Environment

### Environment Variables

**Database Configuration:**
```env
DB_URL=mongodb://localhost:27017
DB_NAME=vibe
```

**Application Configuration:**
```env
NODE_ENV=development|staging|production
APP_PORT=8080
APP_URL=http://localhost:8080
APP_ORIGINS=http://localhost:5173,https://vibe.example.com
APP_MODULE=all
APP_ROUTE_PREFIX=/api
FRONTEND_URL=http://localhost:5173
ADMIN_PASSWORD=admin123
```

**Firebase Configuration:**
```env
FIREBASE_API_KEY=...
FIREBASE_PROJECT_ID=...
FIREBASE_CLIENT_EMAIL=...
FIREBASE_PRIVATE_KEY=...
FIREBASE_STORAGE_BUCKET=...
```

**Google Cloud Configuration:**
```env
GCLOUD_PROJECT=...
GOOGLE_APPLICATION_CREDENTIALS=/path/to/credentials.json
GOOGLE_ANOMALY_BUCKET=vibe-anomaly-data
GOOGLE_FACES_BUCKET=vibe-faces-data
GOOGLE_AI_SERVER_BUCKET=vibe-aiserver-data
```

**AI Configuration:**
```env
AI_SERVER_IP=localhost
AI_SERVER_PORT=9017
AI_PROXY_ADDRESS=socks5h://localhost:1055
ANTHROPIC_CRED=...
ANTHROPIC_MODEL=claude-3-haiku
```

**Backup Configuration:**
```env
ENABLE_DB_BACKUP=true
ENABLE_HP_JOB=true
GCP_BACKUP_BUCKET=vibe-backups
GCP_BACKUP_ACTIVITY_BUCKET=vibe-activity-backups
```

**Email/SMTP Configuration:**
```env
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=...
SMTP_PASSWORD=...
SMTP_FROM=noreply@vibe.example.com
```

**Sentry Configuration:**
```env
SENTRY_DSN=https://...@sentry.io/...
```

**Media Encryption:**
```env
MEDIA_ENCRYPTION_KEY=...
```

### Configuration Files

#### Backend Config (`backend/src/config/`)

1. **app.ts** - Application settings
   - Environment detection
   - Port and URL configuration
   - CORS origins
   - Module selection
   - Firebase settings
   - Sentry configuration

2. **db.ts** - Database settings
   - MongoDB connection URL
   - Database name

3. **storage.ts** - Cloud storage settings
   - GCS project configuration
   - Bucket names
   - Encryption keys

4. **ai.ts** - AI service settings
   - Server IP and port
   - Anthropic credentials
   - Proxy configuration

5. **smtp.ts** - Email service settings
   - SMTP server configuration
   - Authentication credentials

6. **sentry.ts** - Error tracking settings
   - DSN configuration
   - Environment specification

#### Frontend Config

1. **vite.config.ts** - Build and dev server configuration
   - Proxy settings for API
   - Build optimization
   - Worker configuration

2. **tsconfig.json** - TypeScript compilation
   - Target ES2022
   - Strict mode disabled
   - Path aliases

3. **postcss.config.js** - Tailwind CSS processing

4. **components.json** - shadcn/ui component configuration

### Multi-Environment Support

**Development Environment:**
- Local MongoDB instance
- Local Firebase emulator (optional)
- Localhost API and frontend
- Hot reload enabled
- Debug logging

**Staging Environment:**
- Cloud MongoDB instance
- Firebase staging project
- Cloud-hosted API
- GCS buckets for staging
- Sentry staging DSN

**Production Environment:**
- Cloud MongoDB (replicated)
- Firebase production project
- CDN-hosted frontend
- Production GCS buckets
- Sentry production DSN
- Backup enabled

---

## Build Process

### Backend Build

**Build Tool:** TypeScript Compiler (tsc) + SWC

**Build Steps:**

1. **Install Dependencies**
   ```bash
   pnpm install
   ```

2. **Compile TypeScript**
   ```bash
   pnpm run build          # tsc
   ```

3. **Output Structure**
   ```
   backend/build/
   ├── index.js
   ├── bootstrap/
   ├── config/
   ├── modules/
   ├── shared/
   └── utils/
   ```

**Key Build Scripts (backend/package.json):**
```json
{
  "scripts": {
    "start": "tsc && node build/index.js",
    "dev": "concurrently \"pnpm run watch:compile\" \"pnpm run watch:build\"",
    "watch:compile": "tsc --watch",
    "watch:build": "nodemon --watch build --ext js --exec \"node build/index.js\"",
    "build": "tsc",
    "generate": "plop",
    "test": "vitest --ui",
    "test:watch": "vitest run --watch",
    "test:ci": "vitest run --coverage --reporter=html",
    "sentry:sourcemaps": "sentry-cli sourcemaps inject --org vicharana-shala --project vibe-server ./build && sentry-cli sourcemaps upload --org vicharana-shala --project vibe-server ./build"
  }
}
```

**Build Artifacts:**
- JavaScript files in `build/` directory
- Source maps for debugging
- Source maps uploaded to Sentry

### Frontend Build

**Build Tool:** Vite

**Build Steps:**

1. **Install Dependencies**
   ```bash
   pnpm install
   ```

2. **Compile TypeScript & Bundle**
   ```bash
   pnpm run build       # tsc -b && vite build
   ```

3. **Output Structure**
   ```
   frontend/dist/
   ├── index.html
   ├── assets/
   │   ├── index-*.js
   │   ├── vendor-*.js
   │   └── style-*.css
   └── worker/
       └── *.worker-*.js
   ```

**Key Build Scripts (frontend/package.json):**
```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "lint": "gts lint",
    "preview": "vite preview",
    "clean": "gts clean",
    "compile": "tsc",
    "fix": "gts fix",
    "copy": "cd ../backend && node scripts/generate-openapi.cjs --output ../../frontend/openapi.json",
    "gen-schema": "pnpx openapi-typescript openapi.json --output src/lib/api/schema.ts"
  }
}
```

**Build Features:**
- Source maps generation
- Vendor bundle splitting
- Asset chunking for caching
- Web worker compilation

### Docker Builds

**Backend Dockerfile (Multi-stage):**
```dockerfile
# Stage 1: Build
FROM node:22-alpine
RUN apk add --no-cache git
RUN corepack enable && corepack prepare pnpm@10.4.1 --activate
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
COPY scripts ./scripts
RUN pnpm install
COPY . .
RUN pnpm tsc

# Stage 2: Runtime
FROM node:22-alpine
RUN apk add --no-cache dumb-init wget
WORKDIR /app
COPY package.json ./
COPY scripts ./scripts
COPY --from=builder /app/build ./build
COPY --from=builder /app/node_modules ./node_modules
# Tailscale setup for VPN
COPY --from=docker.io/tailscale/tailscale:stable /usr/local/bin/tailscaled /app/tailscaled
COPY --from=docker.io/tailscale/tailscale:stable /usr/local/bin/tailscale /app/tailscale
RUN mkdir -p /var/run/tailscale /var/cache/tailscale /var/lib/tailscale
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:${APP_PORT}/health || exit 1
CMD ["sh", "/app/scripts/start.sh"]
```

**Frontend Dockerfile (Multi-stage):**
```dockerfile
# Stage 1: Build
FROM node:20-alpine
RUN corepack enable && corepack prepare pnpm@8.10.0 --activate
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install
COPY . .
RUN pnpm build

# Stage 2: Serve with Nginx
FROM nginx:stable-alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

### Dependency Management

**Package Manager:** pnpm

**Monorepo Structure:**
```yaml
# pnpm-workspace.yaml
packages:
  - frontend
  - backend
  - backend/functions
  - docs
  - cli
  - mcp
  - e2e
```

**Lock File:** `pnpm-lock.yaml`
- Deterministic dependency resolution
- Version pinning
- Reproducible builds

---

## Deployment Architecture

### Firebase Hosting Deployment

**Configuration (firebase.json):**
```json
{
  "hosting": [
    {
      "target": "staging",
      "public": "frontend/dist",
      "rewrites": [
        { "source": "**", "destination": "/index.html" }
      ]
    },
    {
      "target": "production",
      "public": "frontend/dist",
      "rewrites": [
        { "source": "**", "destination": "/index.html" }
      ]
    }
  ]
}
```

**Deployment Process:**
1. Build frontend: `pnpm run build`
2. Deploy to Firebase: `firebase deploy --only hosting:staging|production`

### Backend Deployment

**Deployment Options:**

1. **Google Cloud Run** (Recommended)
   - Containerized deployment
   - Automatic scaling
   - Health check support
   - Environment variable injection

2. **Docker Compose** (Development)
   - Local container orchestration
   - Service dependencies
   - Network isolation

3. **Kubernetes** (Enterprise)
   - Container orchestration
   - Auto-scaling
   - Load balancing
   - Health probes

**Docker Deployment:**
```bash
# Build image
docker build -f Dockerfile -t vibe-backend:latest .

# Run container
docker run -d \
  -p 8080:8080 \
  -e DB_URL=mongodb://mongo:27017 \
  -e APP_URL=http://localhost:8080 \
  --name vibe-backend \
  vibe-backend:latest
```

### Database Deployment

**MongoDB Deployment Options:**

1. **MongoDB Atlas** (Cloud-managed)
   - Automatic backups
   - Replication
   - Scaling
   - Monitoring

2. **Self-hosted MongoDB**
   - Docker container
   - Docker Compose with persistence volume
   - Kubernetes StatefulSet

### Storage Deployment

**Google Cloud Storage:**
- Separate buckets for different data types
- IAM roles and service accounts
- Lifecycle policies for cleanup
- Encryption at rest and in transit

### Deployment Pipeline

**Staging Deployment:**
1. Commit to `staging` branch
2. GitHub Actions workflow triggered
3. Run tests and linting
4. Build backend Docker image
5. Build frontend
6. Deploy frontend to Firebase staging
7. Deploy backend to Cloud Run staging

**Production Deployment:**
1. Merge to `main` branch (via PR)
2. Create release tag
3. GitHub Actions workflow triggered
4. Build and push Docker image to registry
5. Deploy backend to Cloud Run production
6. Deploy frontend to Firebase production
7. Run smoke tests
8. Notify deployment team

---

## API Specifications

### API Overview

**Base URL:** `http://localhost:8080/api` (development)

**API Documentation:** `/api/reference` (Scalar UI)

**OpenAPI Spec:** Generated from controllers via routing-controllers

### Request/Response Format

**Content-Type:** `application/json`

**Request Headers:**
```
Content-Type: application/json
Authorization: Bearer <JWT_TOKEN>
X-Requested-With: XMLHttpRequest
```

**Response Format:**
```json
{
  "success": true,
  "data": { /* response body */ },
  "error": null,
  "timestamp": "2026-04-28T12:00:00Z"
}
```

**Error Response:**
```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "RESOURCE_NOT_FOUND",
    "message": "Course not found",
    "details": { /* additional context */ }
  },
  "timestamp": "2026-04-28T12:00:00Z"
}
```

### Authentication

**JWT Token:**
```
Header: Authorization: Bearer <token>
Token Format: JWT with HS256/RS256 signature
Expiration: Configurable (typically 24-48 hours)
```

**Token Verification:**
- Decode JWT payload
- Verify signature with Firebase public key
- Check token expiration
- Extract user info from claims

### API Versioning

**Current Version:** v1 (implicit in `/api` prefix)

**Future Versioning:**
- URL-based: `/api/v2/...`
- Header-based: `API-Version: 2`

### Rate Limiting

**Global Rate Limiter:**
- Configured via `createRateLimiter()`
- Default: Not enforced on all routes
- Per-route limits can be configured

**Rate Limit Headers:**
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1234567890
```

### CORS Configuration

**Allowed Origins (from config):**
```
Default: http://localhost:5173
Configurable via APP_ORIGINS env var
```

**Allowed Methods:**
```
GET, POST, PUT, PATCH, DELETE, OPTIONS
```

**Allowed Headers:**
```
Content-Type
Authorization
X-Requested-With
```

### Pagination

**Query Parameters:**
```
?page=1&pageSize=20&sort=-createdAt&filter={status: "published"}
```

**Response:**
```json
{
  "data": [...],
  "pagination": {
    "currentPage": 1,
    "totalPages": 5,
    "totalItems": 100,
    "pageSize": 20
  }
}
```

### Validation Rules

**Request Validation:**
- Controllers use validators from modules
- `class-validator` for schema validation
- Decorators for field-level rules
- Custom validators for complex logic

**Validation Error Response:**
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": {
      "email": ["Email is required", "Email must be valid"],
      "password": ["Password must be at least 8 characters"]
    }
  }
}
```

---

## Security Specifications

### Authentication & Authorization

**Authentication Methods:**
1. **Firebase Authentication**
   - Email/password signup and login
   - Social login (Google, etc.)
   - Phone authentication (optional)
   - Custom claims for user roles

2. **JWT Bearer Tokens**
   - Used for API requests
   - Token refresh mechanism
   - Expiration-based invalidation

**Authorization Controls:**
```typescript
// Role-based access control
@UseGuards(AuthorizationChecker)
@Authorize(['admin', 'instructor'])
async updateCourse(@Param('id') id: string) { }

// Custom permission checks
@UseGuards(CaslGuard)
async deleteCourse(@Param('id') id: string) { }
```

### Data Protection

**Encryption:**
- TLS/SSL for all network communication
- Encryption at rest for sensitive data
- Hashed passwords in Firebase
- Encrypted file storage (GCS)

**Data Masking:**
- PII not logged in plain text
- Email addresses masked in logs
- Passwords never logged

### Input Validation & Sanitization

**Validation:**
- All inputs validated before processing
- Type checking via TypeScript
- Schema validation via class-validator
- Custom validation rules

**Sanitization:**
- HTML encoding for user-generated content
- SQL injection prevention (MongoDB mitigates)
- XSS protection via React JSX escaping

### CORS & CSP

**CORS:**
- Whitelist of allowed origins
- Credentials: true for same-origin requests
- Preflight caching enabled

**Content Security Policy (future):**
```
default-src 'self'
script-src 'self' trusted-domains
style-src 'self' 'unsafe-inline'
img-src 'self' data: https:
font-src 'self' data:
```

### Session Management

**Session Security:**
- Secure HTTP-only cookies (when used)
- SameSite cookie policy
- CSRF tokens for state-changing operations

### Audit Logging

**Logged Events:**
- User login/logout
- Data modifications (CRUD operations)
- Authorization failures
- Anomaly detection triggers

**Audit Trail Storage:**
- Stored in `auditTrails` MongoDB collection
- Includes timestamp, user, action, resource
- Immutable (no deletion, only marking as reviewed)

### Compliance & Standards

**Standards Adherence:**
- OWASP Top 10 mitigation
- GDPR data handling (where applicable)
- FERPA compliance (education context)
- SOC 2 audit readiness

### Secrets Management

**Environment Variables:**
- Never committed to version control
- .env files in .gitignore
- Load from secure vault (Google Secret Manager)

**Service Accounts:**
- Google Cloud service account JSON
- Firebase service account key
- Limited IAM roles (principle of least privilege)

---

## Testing Architecture

### Unit Testing

**Framework:** Vitest

**Configuration (vite.config.ts):**
```typescript
test: {
  environment: 'node',
  include: ['src/**/*.test.ts'],
  hookTimeout: 30000
}
```

**Test Structure:**
```
backend/src/modules/auth/__tests__/
├── auth.controller.test.ts
├── auth.service.test.ts
└── auth.repository.test.ts
```

**Test Execution:**
```bash
pnpm test              # Run with UI
pnpm test:watch       # Watch mode
pnpm test:ci          # CI mode with coverage report
```

**Coverage Goals:**
- Minimum 80% line coverage
- Critical paths: 95% coverage
- Services and repositories: 90%+

### Integration Testing

**Database Testing:**
- MongoDB memory server for isolated testing
- Transaction rollback between tests
- Fixture/seed data management

**API Testing:**
- Supertest for HTTP assertions
- Mock external services
- Test complete request/response cycle

### E2E Testing

**Framework:** Playwright

**Configuration (e2e/playwright.config.ts):**
```typescript
{
  testDir: './tests',
  timeout: 10 * 60 * 60 * 1000,  // 10 hours
  workers: 1,                     // Single worker for shared state
  screenshot: 'only-on-failure',
  video: 'retain-on-failure'
}
```

**Test Scenarios:**
- Student course enrollment flow
- Quiz completion and grading
- Proctoring features
- Anomaly detection triggers
- Role-based access control

**Test Execution:**
```bash
cd e2e
pnpm install
pnpm test
```

**Test Assets:**
- Fake webcam video (y4m format)
- Fake audio (wav format)
- Test course data

### Performance Testing

**Load Testing:**
- Apache JMeter or k6 (future)
- API endpoint load profiles
- Concurrent user simulation
- Response time baselines

**Profiling:**
- Sentry APM for production
- Node.js built-in profiler
- Memory leak detection

### Continuous Integration (GitHub Actions)

**Workflow Triggers:**
- Push to main/staging/develop
- Pull requests
- Manual trigger

**CI Pipeline Steps:**
1. Install dependencies
2. Run linting (ESLint, TypeScript)
3. Run unit tests
4. Run integration tests
5. Build Docker images
6. Run E2E tests (staging)
7. Coverage report
8. Deploy to staging (if passing)

---

## Development Workflow

### Local Development Setup

**Prerequisites:**
- Node.js 22 LTS
- pnpm 10.12.1+
- MongoDB 6.0+
- Git

**Initial Setup:**
```bash
# Clone repository
git clone https://github.com/continuousactivelearning/vibe.git
cd vibe

# Install dependencies
pnpm install

# Setup environment files
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

# Configure MongoDB
# Edit backend/.env with local MongoDB URL

# Run setup script
pnpm vibe setup
```

**Development Server:**

```bash
# Terminal 1: Backend
cd backend
pnpm run dev

# Terminal 2: Frontend
cd frontend
pnpm run dev

# Access:
# Frontend: http://localhost:5173
# Backend API: http://localhost:8080
# API Docs: http://localhost:8080/api/reference
```

**Development Tools:**
- VS Code with TypeScript support
- Postman/Insomnia for API testing
- MongoDB Compass for database browsing
- Chrome DevTools for frontend debugging

### Code Generation

**Plop Templates:**
```bash
cd backend
pnpm run generate

# Follow prompts:
# Select template (controller, service, repository)
# Enter module name
# Enter entity name
```

**Generated Artifacts:**
```
backend/src/modules/mymodule/
├── controllers/
├── services/
├── repositories/
├── validators/
├── tests/
└── types.ts
```

### Commit Guidelines

**Commit Message Format:**
```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:**
- `feat:` New feature
- `fix:` Bug fix
- `refactor:` Code refactoring
- `test:` Adding tests
- `docs:` Documentation
- `style:` Code style changes
- `chore:` Build, dependencies

**Examples:**
```
feat(auth): Add email verification flow
fix(quizzes): Prevent negative scores on partial credit
refactor(courses): Extract module loading logic
test(users): Add enrollment service tests
docs: Update API documentation
```

### Git Workflow

**Branch Strategy:** Git Flow

```
main (production)
  ↑
  └── release/* (staging)
        ↑
        └── develop (integration)
              ↑
              ├── feature/* (new features)
              ├── fix/* (bug fixes)
              └── refactor/* (code improvements)
```

**Feature Development:**
```bash
# Create feature branch
git checkout -b feature/course-versioning

# Make commits
git commit -m "feat(courses): Add version control"

# Create Pull Request
# Review and merge to develop

# Merge to staging
git checkout release/v1.1
git merge develop

# Merge to production
git checkout main
git merge release/v1.1
git tag v1.1.0
```

### Code Review Process

**PR Requirements:**
- ≥2 approvals from maintainers
- CI pipeline passing
- Code coverage maintained or improved
- No conflicting changes

**Review Checklist:**
- [ ] Code follows style guide
- [ ] Tests added/updated
- [ ] Documentation updated
- [ ] No breaking changes (unless minor version bump)
- [ ] Security implications reviewed

---

## Maintenance & Operations

### Monitoring & Observability

**Sentry Integration:**
- Real-time error tracking
- Performance monitoring (APM)
- Release tracking
- Source map uploads

**Logging:**
```typescript
// Structured logging
console.log('Event', { userId, action, timestamp });

// Sentry breadcrumbs
Sentry.captureMessage('Critical action completed', 'info');
```

**Health Checks:**
```
GET /health  → { status: "ok", uptime: "2h 30m" }
```

### Backup & Recovery

**Database Backups:**
- Google Cloud Storage buckets
- Automated daily backups
- Retention: 30-90 days
- Point-in-time recovery support

**File Backups:**
- GCS bucket lifecycle policies
- Versioning enabled
- Cross-region replication

**Backup Verification:**
- Monthly restore tests
- Recovery time objectives (RTO): 1 hour
- Recovery point objectives (RPO): 1 day

### Database Maintenance

**Index Maintenance:**
- Regular analysis of query performance
- Index rebuilding (monthly)
- Unused index removal

**Data Cleanup:**
- TTL indexes for temporary data
- Orphaned document removal
- Archive old quiz attempts (> 1 year)

**Database Optimization:**
```javascript
// Analyze query performance
db.courses.find({status: "published"}).explain("executionStats")

// Rebuild indexes
db.courses.reIndex()

// Compact collection
db.runCommand({ compact: "courses" })
```

### Scaling Considerations

**Horizontal Scaling:**
- Stateless backend (can run multiple instances)
- Load balancer distribution
- Database read replicas
- CDN for static assets

**Vertical Scaling:**
- Increase machine resources
- Optimize code hot paths
- Cache frequently accessed data

**Caching Strategy:**
- Redis for session storage (future)
- Browser caching for assets
- API response caching (ETag, Cache-Control headers)

### Disaster Recovery

**RTO/RPO Targets:**
- RTO: 2 hours (recover to operational state)
- RPO: 1 hour (minimal data loss)

**Recovery Procedures:**
1. **Database Failure**
   - Restore from latest backup
   - Verify data integrity
   - Update DNS to failover instance

2. **Application Failure**
   - Redeploy from last known good image
   - Verify health checks pass
   - Restore configuration from vault

3. **Data Corruption**
   - Identify corruption point
   - Restore from backup before corruption
   - Replay transaction logs if available

### Performance Optimization

**Frontend Optimization:**
- Code splitting at route level
- Lazy loading of components
- Image optimization
- CSS/JS minification and compression
- HTTP/2 server push

**Backend Optimization:**
- Database query optimization
- Connection pooling
- Caching layer (Redis future)
- Async processing for long operations
- Compression (gzip)

**Monitoring Metrics:**
- Page load time (< 3s)
- API response time (< 200ms p95)
- Database query time (< 100ms p95)
- Error rate (< 0.1%)

### Security Maintenance

**Dependency Updates:**
- Monthly security patch updates
- Vulnerability scanning (Dependabot)
- Breaking change assessment

**Access Control Review:**
- Quarterly IAM role review
- Remove inactive user accounts
- Rotate service account keys

**Security Testing:**
- Penetration testing (annual)
- Static code analysis (per PR)
- Dynamic analysis (pre-release)

### Incident Response

**Severity Levels:**
- **P1 (Critical):** System down, major functionality broken
- **P2 (High):** Significant degradation, partial outages
- **P3 (Medium):** Minor issues, workarounds available
- **P4 (Low):** Cosmetic, no user impact

**Response Process:**
1. Alert triggered
2. On-call engineer acknowledged
3. Severity assessed
4. Incident commander assigned (P1/P2)
5. Root cause analysis
6. Fix deployed
7. Post-mortem (P1/P2)

**Runbooks (Standard Procedures):**
- API server restart
- Database failover
- Clear cache
- Rollback deployment

---

## Appendix

### A. Environment Variables Reference

**Complete List:**

**Application:**
- `NODE_ENV`: development|staging|production
- `APP_PORT`: Server port (default: 8080)
- `APP_URL`: Public server URL
- `APP_ORIGINS`: CORS origins (comma-separated)
- `APP_MODULE`: Module to load (all|auth|users|courses|quizzes)
- `APP_ROUTE_PREFIX`: API prefix (default: /api)
- `FRONTEND_URL`: Frontend URL for redirects
- `ADMIN_PASSWORD`: Default admin password

**Database:**
- `DB_URL`: MongoDB connection string
- `DB_NAME`: Database name (default: vibe)

**Firebase:**
- `FIREBASE_API_KEY`: Firebase API key
- `FIREBASE_PROJECT_ID`: GCP project ID
- `FIREBASE_CLIENT_EMAIL`: Service account email
- `FIREBASE_PRIVATE_KEY`: Service account private key
- `FIREBASE_STORAGE_BUCKET`: Storage bucket name

**Google Cloud:**
- `GCLOUD_PROJECT`: GCP project ID
- `GOOGLE_APPLICATION_CREDENTIALS`: Path to service account JSON
- `GOOGLE_ANOMALY_BUCKET`: Anomaly data bucket
- `GOOGLE_FACES_BUCKET`: Face detection bucket
- `GOOGLE_AI_SERVER_BUCKET`: AI server data bucket

**AI Integration:**
- `AI_SERVER_IP`: AI server hostname
- `AI_SERVER_PORT`: AI server port (default: 9017)
- `AI_PROXY_ADDRESS`: SOCKS5 proxy address
- `ANTHROPIC_CRED`: Anthropic API key
- `ANTHROPIC_MODEL`: Model name (e.g., claude-3-haiku)

**Backup:**
- `ENABLE_DB_BACKUP`: Enable automatic backups (true|false)
- `ENABLE_HP_JOB`: Enable HP job processing (true|false)
- `GCP_BACKUP_BUCKET`: Backup storage bucket
- `GCP_BACKUP_ACTIVITY_BUCKET`: Activity backup bucket

**Email:**
- `SMTP_HOST`: SMTP server hostname
- `SMTP_PORT`: SMTP port (587 for TLS)
- `SMTP_USER`: SMTP authentication user
- `SMTP_PASSWORD`: SMTP authentication password
- `SMTP_FROM`: Sender email address

**Monitoring:**
- `SENTRY_DSN`: Sentry Data Source Name

**Media:**
- `MEDIA_ENCRYPTION_KEY`: Encryption key for media files

### B. Docker Commands Reference

**Build:**
```bash
# Backend
docker build -f backend/Dockerfile -t vibe-backend:latest -t vibe-backend:v1.0.0 .

# Frontend
docker build -f frontend/Dockerfile -t vibe-frontend:latest -t vibe-frontend:v1.0.0 .
```

**Run:**
```bash
# Backend
docker run -d \
  --name vibe-backend \
  -p 8080:8080 \
  -e NODE_ENV=production \
  -e DB_URL=mongodb://mongo:27017 \
  --network vibe-network \
  vibe-backend:latest

# Frontend
docker run -d \
  --name vibe-frontend \
  -p 80:80 \
  --network vibe-network \
  vibe-frontend:latest

# MongoDB
docker run -d \
  --name vibe-mongo \
  -p 27017:27017 \
  -v mongo-data:/data/db \
  --network vibe-network \
  mongo:latest
```

**Docker Compose:**
```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f backend frontend mongo

# Stop services
docker-compose down
```

### C. Useful Commands

**Package Management:**
```bash
# Install dependencies
pnpm install

# Add dependency
pnpm add package-name

# Update dependencies
pnpm update

# Clean install
pnpm install --frozen-lockfile

# Workspace-specific
pnpm --filter=backend install
```

**Testing:**
```bash
# Run all tests
pnpm test:ci

# Run specific test file
pnpm test -- auth.service.test.ts

# Watch mode
pnpm test:watch

# Coverage report
pnpm test:ci --coverage
```

**Building:**
```bash
# Backend
cd backend && pnpm build

# Frontend
cd frontend && pnpm build

# All (root)
pnpm --recursive build
```

**Linting & Formatting:**
```bash
# Lint
pnpm lint

# Fix issues
pnpm fix

# Check types
pnpm tsc --noEmit
```

**Database:**
```bash
# Connect to MongoDB
mongosh mongodb://localhost:27017/vibe

# Backup
mongodump --uri="mongodb://localhost:27017/vibe" --out=./backup

# Restore
mongorestore --uri="mongodb://localhost:27017/vibe" ./backup
```

### D. API Endpoint Summary

**Auth:**
```
POST   /api/auth/signup
POST   /api/auth/login
POST   /api/auth/refresh-token
POST   /api/auth/verify-token
POST   /api/auth/password-reset
POST   /api/auth/change-password
GET    /api/auth/me
```

**Courses:**
```
GET    /api/courses
POST   /api/courses
GET    /api/courses/:id
PUT    /api/courses/:id
DELETE /api/courses/:id
GET    /api/courses/:id/versions
POST   /api/courses/:id/versions
```

**Quizzes:**
```
GET    /api/quizzes
POST   /api/quizzes
GET    /api/quizzes/:id
PUT    /api/quizzes/:id
DELETE /api/quizzes/:id
POST   /api/quizzes/:id/attempts
POST   /api/quizzes/:id/submit
GET    /api/quizzes/:id/results
```

**Users:**
```
GET    /api/users/:id
PUT    /api/users/:id
GET    /api/users/:id/enrollments
POST   /api/users/:id/enrollments
GET    /api/users/:id/progress
```

**Notifications:**
```
GET    /api/notifications
POST   /api/notifications/send
PUT    /api/notifications/:id/read
POST   /api/invites
GET    /api/invites/:id
PUT    /api/invites/:id/accept
```

### E. Project Statistics

**Codebase:**
- Backend: ~15,000 lines of TypeScript
- Frontend: ~20,000 lines of TypeScript/JSX
- Tests: ~5,000 lines
- Documentation: ~3,000 lines

**Dependencies:**
- Backend: 50+ npm packages
- Frontend: 80+ npm packages
- Dev tools: 30+ packages

**Database:**
- Collections: 20+
- Indexes: 50+
- Expected data: 1GB-10GB (depending on course content)

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-04-28 | System | Initial formal specifications document |

---

**End of Document**

---

## How to Use This Document

This formal specifications document serves as the single source of truth for building and deploying the ViBe platform. Use this document to:

1. **Onboard New Developers** - Complete understanding of the system
2. **Setup Development Environment** - Follow the setup section
3. **Deploy to New Infrastructure** - Deployment architecture section
4. **Troubleshoot Issues** - Check maintenance and operations section
5. **Scale the System** - Review scaling considerations
6. **Understand Security** - Review security specifications
7. **Reference API Endpoints** - Use API specifications section
8. **Configure Environment** - Configuration & Environment section

For any updates or clarifications needed, please open an issue in the GitHub repository.
