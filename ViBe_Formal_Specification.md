# ViBe Platform: Formal Specification & Deep Technical Documentation

---

## 1. Introduction & Scope

This document provides a comprehensive, formal specification and technical blueprint for the ViBe platform. It is designed to enable a highly capable agent or engineering team to fully recreate the system from scratch, covering backend, frontend, CLI, infrastructure, and integration details.

---

## 2. System Overview & Architecture

- **Architecture:** Modular, service-oriented, TypeScript/Node.js backend (InversifyJS, routing-controllers, MongoDB), React frontend (TanStack Router, React Query, Context API), CLI utilities, and supporting scripts.
- **Major Components:**
  - Backend API server (REST, modular)
  - Frontend SPA (React)
  - CLI tools
  - Database (MongoDB)
  - Integration with Firebase, Sentry, and other services

---

## 3. Backend Modules & Responsibilities

### 3.1. Module Structure
- Each domain (e.g., emotions, users, courses, quizzes, notifications, audit trails, projects, reports, auth) is a module with:
  - `controllers/` (API endpoints)
  - `services/` (business logic)
  - `repositories/` (data access)
  - `types.ts`, `interfaces/`, `classes/` (types, validation)

### 3.2. Example: Emotions Module
- **Purpose:** Collects and manages emotional feedback from users on course items.
- **API:**
  - `POST /emotions/submit` — Submit or update emotion for a course item
  - Auth required, body includes courseId, itemId, emotion, feedbackText, cohortId
- **Data Model:**
  - EmotionDocument: { studentId, courseId, courseVersionId, itemId, emotion, feedbackText, timestamp, cohortId }
- **Workflow:**
  - If emotion exists for student+item, update; else, insert new

### 3.3. Other Modules
- **Users:** Registration, authentication, profile, progress
- **Courses:** Course CRUD, enrollment, versioning
- **Quizzes:** Quiz delivery, attempts, grading
- **Notifications:** System/user notifications, invites
- **Audit Trails:** Track user actions for compliance
- **Projects:** Submission, review, progress
- **Reports:** Issue reporting, status tracking
- **Auth:** Firebase-based authentication, password management

---

## 4. API Specification (Representative)

### 4.1. Authentication
- `POST /auth/signup` — Register new user
- `POST /auth/login` — Login
- `PATCH /auth/change-password` — Change password

### 4.2. Courses
- `GET /courses` — List courses
- `POST /courses` — Create course
- `GET /courses/:id` — Get course details

### 4.3. Emotions
- `POST /emotions/submit` — Submit/update emotion

### 4.4. Notifications
- `GET /notifications` — List notifications
- `POST /notifications/mark-read` — Mark as read

### 4.5. Projects
- `POST /project/submit` — Submit project

### 4.6. Reports
- `POST /reports` — Submit report
- `GET /reports` — List reports

**All endpoints use JWT-based auth (Bearer token), JSON request/response, and standard HTTP status codes.**

---

## 5. Data Models & Schemas (Representative)

### 5.1. User
- _id: ObjectId
- email: string
- passwordHash: string
- name: string
- roles: string[]
- createdAt, updatedAt

### 5.2. Course
- _id: ObjectId
- title: string
- description: string
- version: string
- items: [ { _id, name, type, order } ]

### 5.3. Emotion
- _id: ObjectId
- studentId: ObjectId
- courseId: ObjectId
- itemId: ObjectId
- emotion: enum (very_sad, sad, neutral, happy, very_happy)
- feedbackText: string
- timestamp: Date

### 5.4. Notification
- _id: ObjectId
- userId: ObjectId
- message: string
- read: boolean
- createdAt: Date

---

## 6. Key Workflows & Algorithms

### 6.1. Emotion Submission
1. User submits emotion for a course item.
2. If an entry exists for (studentId, itemId), update it; else, insert new.
3. Optionally, trigger analytics or notifications.

### 6.2. Authentication
1. User registers/logins via Firebase Auth.
2. JWT issued, used for all subsequent requests.

### 6.3. Course Enrollment
1. User enrolls in course.
2. Enrollment record created; triggers notifications and progress tracking.

---

## 7. Frontend Architecture

- **Framework:** React (with TanStack Router, React Query, Context API)
- **Entry Point:** `src/app/app.tsx`, `src/app/main.tsx`
- **Routing:** `/app/routes/router.ts`
- **State:** AuthProvider, QueryClientProvider
- **UI:** Modular components (CourseCard, ModalWrapper, FaceRecognitionComponent, etc.)
- **AI/Proctoring:** Face recognition, gesture/speech detection (see `src/components/ai/`)
- **Theming:** ThemeProvider, dark/light mode

---

## 8. CLI & Scripts

- **Location:** `cli/src/`
- **Entrypoint:** `cli.ts`
- **Capabilities:** Project scaffolding, utility commands, root finding, etc.
- **Usage:** `node cli/dist/cli.js <command>`

---

## 9. Configuration & Deployment

- **Config Files:** `.env`, `firebase.json`, `tsconfig.json`, `vite.config.ts`, etc.
- **Docker:** `Dockerfile`, `Dockerfile-all` for backend/frontend
- **Database:** MongoDB (connection via config)
- **Cloud:** Firebase integration, Sentry for error tracking
- **Build:** `pnpm`, `vite`, `tsc`

---

## 10. Security & Compliance

- JWT-based authentication
- Role-based access control (RBAC)
- Audit trails for sensitive actions
- Input validation (class-validator)
- HTTPS recommended for deployment

---

## 11. Glossary & References

- **InversifyJS:** Dependency injection for TypeScript/Node.js
- **routing-controllers:** Declarative API routing
- **TanStack Router:** React router
- **React Query:** Data fetching/caching
- **MongoDB:** NoSQL database
- **Firebase:** Auth, hosting, cloud functions
- **Sentry:** Error monitoring

---

## 12. System Design Rationale

- Modular, testable codebase for maintainability
- Strong typing and validation for reliability
- Cloud-native, scalable deployment
- Extensible for new modules/domains

---

## 13. Recreation Checklist

1. Set up MongoDB, Firebase, Sentry, and environment variables
2. Build backend (Node.js, InversifyJS, routing-controllers)
3. Implement all modules as described
4. Build frontend (React, TanStack Router, React Query)
5. Implement CLI utilities
6. Configure Docker, CI/CD, and deployment
7. Test all workflows end-to-end

---

## 14. Appendix: Directory Structure (Partial)

- backend/
  - src/
    - modules/
      - emotions/
      - users/
      - courses/
      - quizzes/
      - notifications/
      - auditTrails/
      - projects/
      - reports/
      - auth/
    - shared/
    - config/
    - utils/
  - build/
- frontend/
  - src/
    - app/
    - components/
    - hooks/
    - layouts/
    - store/
    - utils/
- cli/
  - src/
- docs/

---

This document is sufficient for a super-capable agent or engineering team to fully recreate the ViBe platform, including all major workflows, APIs, data models, and architectural decisions. For further detail, refer to the codebase and in-line comments.
