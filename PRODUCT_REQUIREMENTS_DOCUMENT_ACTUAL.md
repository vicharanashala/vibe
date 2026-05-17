# ViBe Platform - Product Requirements Document (ACTUAL IMPLEMENTATION)

**Document Version:** 1.0 - REALITY-BASED  
**Last Updated:** April 29, 2026  
**Status:** Documents Current Codebase Implementation  
**Purpose:** Provide complete specifications for rebuilding ViBe platform from this document alone

---

## Executive Summary

### What is ViBe?

ViBe is a **comprehensive learning management and assessment platform** currently deployed in production with 16 fully-implemented backend modules. The system is designed for continuous assessment, learner engagement tracking, and AI-powered educational support.

**Core Capabilities (Implemented & Active):**
- Course creation and management with hierarchical structure (Course → Module → Section → Item)
- Multi-question-type quiz engine with auto-grading
- User enrollment and progress tracking
- Firebase-based authentication and authorization
- Learner emotion tracking and sentiment analysis (NEW)
- AI-powered question generation (Anthropic SDK)
- Anomaly detection for academic integrity
- Comprehensive analytics and reporting
- Gamification system (HP/points, leaderboards)
- Email notifications and invitations

**Platform Status:**
- ✅ MVP fully launched (16 backend modules operational)
- ✅ Frontend deployed on Firebase Hosting
- ✅ Backend containerized and running on Google Cloud Run
- ✅ MongoDB database with automated backups
- ✅ CI/CD pipeline via GitHub Actions
- ✅ OpenAPI schema auto-generated from controllers

**Current Infrastructure:**
- **Language:** TypeScript 5.9.3 (strict mode)
- **Backend Runtime:** Node.js 22 LTS + Express.js
- **Frontend Runtime:** React 18+, Vite build tool
- **Database:** MongoDB (NoSQL, document-based)
- **Deployment:** Google Cloud Platform (Cloud Run + Firebase Hosting)
- **Container:** Docker (multi-stage builds)
- **CI/CD:** GitHub Actions
- **Monitoring:** Sentry, Firebase Analytics

---

## Architecture Overview

### System Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│                      FRONTEND TIER                               │
│                   React 18 + Vite (SPA)                          │
│             Firebase Hosting (Staging + Production)              │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Pages:                                                  │   │
│  │  - Auth Pages (Login, Signup, Password Reset)          │   │
│  │  - Student Dashboard & Progress                        │   │
│  │  - Course Browser & Enrollment                         │   │
│  │  - Quiz Interface (Taking Quizzes)                     │   │
│  │  - Teacher Management Console                          │   │
│  │  - Analytics & Reports Dashboard                       │   │
│  │  - Emotion Tracking & Sentiment                        │   │
│  │  - Admin Settings                                      │   │
│  │  - HP/Gamification Leaderboards                        │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Client-Side Libraries:                                 │   │
│  │  - TanStack Router v1.46.1 (client-side routing)      │   │
│  │  - TanStack React Query v5+ (data fetching/caching)   │   │
│  │  - shadcn/ui (component library)                      │   │
│  │  - Tailwind CSS v3 (styling)                          │   │
│  │  - MediaPipe + TensorFlow.js (face detection)         │   │
│  │  - Yoopta (rich text editor)                          │   │
│  │  - JSON Schema Form Builder (dynamic forms)           │   │
│  └─────────────────────────────────────────────────────────┘   │
└────────────────┬──────────────────────────────────────────────────┘
                 │
           HTTP/HTTPS with TLS 1.3
                 │
┌────────────────▼──────────────────────────────────────────────────┐
│                        BACKEND TIER                               │
│              Express.js API (Google Cloud Run)                    │
│                      Port: 8080/4001                              │
│                                                                   │
│ ┌──────────────────────────────────────────────────────────────┐ │
│ │ Global Middleware Stack (in order):                        │ │
│ │  1. Sentry Request Handler (performance monitoring)        │ │
│ │  2. CORS Middleware (allow configured origins)             │ │
│ │  3. Express JSON Parser (body max size: 50MB)              │ │
│ │  4. Request Logging Middleware (Morgan-like)               │ │
│ │  5. Authentication Middleware (Firebase JWT)               │ │
│ │  6. Rate Limiter (if enabled)                              │ │
│ │  7. Routing Controllers Router                             │ │
│ │  8. Global Error Handler (HttpErrorHandler)                │ │
│ │  9. Sentry Error Handler (error tracking)                  │ │
│ └──────────────────────────────────────────────────────────────┘ │
│                                                                   │
│ ┌──────────────────────────────────────────────────────────────┐ │
│ │ Request Processing Pipeline:                               │ │
│ │                                                              │ │
│ │  HTTP Request                                               │ │
│     ↓                                                         │ │
│ │  Middleware Chain                                          │ │
│     ↓                                                         │ │
│ │  Routing Controllers (Route Decorator Matching)            │ │
│     ↓                                                         │ │
│ │  Controller Method Invoked                                 │ │
│     ↓                                                         │ │
│ │  Service/Business Logic Executed                           │ │
│     ↓                                                         │ │
│ │  Repository Layer (MongoDB Access)                         │ │
│     ↓                                                         │ │
│ │  Response Transformer Applied                              │ │
│     ↓                                                         │ │
│ │  HTTP Response Sent                                        │ │
│                                                              │ │
│ └──────────────────────────────────────────────────────────────┘ │
│                                                                   │
│ ┌──────────────────────────────────────────────────────────────┐ │
│ │ 16 Implemented Backend Modules:                             │ │
│ │                                                              │ │
│ │ 1. auth/            - Firebase auth, user registration       │ │
│ │ 2. users/           - User profiles, enrollment, progress    │ │
│ │ 3. courses/         - Course CRUD, versions, hierarchy       │ │
│ │ 4. quizzes/         - Quizzes, questions, attempts, grading  │ │
│ │ 5. notifications/   - Email, invitations                     │ │
│ │ 6. settings/        - User/course/proctoring settings        │ │
│ │ 7. anomalies/       - Anomaly detection, proctoring data     │ │
│ │ 8. genAI/           - AI integration, question generation    │ │
│ │ 9. emotions/        - Learner emotion tracking              │ │
│ │ 10. hpSystem/       - Gamification, points, achievements     │ │
│ │ 11. announcements/  - Course announcements                   │ │
│ │ 12. auditTrails/    - Compliance logging                     │ │
│ │ 13. reports/        - Analytics, report generation           │ │
│ │ 14. projects/       - Student project submissions            │ │
│ │ 15. courseRegistration/ - Enrollment workflows               │ │
│ │ 16. ejectionPolicy/ - Student removal rules                  │ │
│ │                                                              │ │
│ │ Each Module Contains: Controllers, Services, Repositories,   │ │
│ │ Validators, TypeScript Interfaces, DI Container Setup       │ │
│ │                                                              │ │
│ └──────────────────────────────────────────────────────────────┘ │
│                                                                   │
│ ┌──────────────────────────────────────────────────────────────┐ │
│ │ Shared Infrastructure (/src/shared):                         │ │
│ │  - Base Services, Controllers, Repositories                  │ │
│ │  - Constants (roles, question types, statuses)               │ │
│ │  - Database Utilities (MongoDB connection, indexing)         │ │
│ │  - Authentication Utilities (JWT validation)                 │ │
│ │  - Middleware Exports                                        │ │
│ │  - Type Definitions (IUser, ICourse, etc.)                   │ │
│ │  - Helper Functions (validators, formatters)                 │ │
│ └──────────────────────────────────────────────────────────────┘ │
└────────────────┬──────────────────────────────────────────────────┘
                 │
         ┌───────┼──────────────────┐
         │       │                  │
         ▼       ▼                  ▼
    ┌────────────────┐        ┌───────────────┐
    │ MongoDB        │        │ Firebase      │
    │ Collections:   │        │               │
    │ - users        │        │ - Auth        │
    │ - courses      │        │ - Firestore   │
    │ - quizzes      │        │   (backup)    │
    │ - questions    │        └───────────────┘
    │ - attempts     │
    │ - enrollments  │        ┌───────────────┐
    │ - emotions     │        │ Google Cloud  │
    │ - anomalies    │        │ Storage (GCS) │
    │ - etc.         │        │               │
    │ (20+ total)    │        │ - Video files │
    └────────────────┘        │ - Uploads     │
                              │ - Anomaly     │
                              │   evidence    │
                              └───────────────┘
                              
                              ┌───────────────┐
                              │ External APIs │
                              │               │
                              │ - Anthropic   │
                              │   (genAI)     │
                              │ - Firebase    │
                              │   Auth        │
                              │ - Sentry      │
                              │ - SMTP (mail) │
                              └───────────────┘
```

### Design Patterns Implemented

1. **Modular Monolith Architecture**
   - 16 independent modules, each with clear boundaries
   - Controllers handle HTTP routing
   - Services contain business logic
   - Repositories abstract data access
   - Validators ensure input integrity
   - Dependency Injection enables loose coupling

2. **Repository Pattern**
   - Each module has Repository classes
   - Abstracts MongoDB access
   - Enables easy testing and future database migration
   - Implements common methods: create, read, update, delete, find, etc.

3. **Service Layer Pattern**
   - Business logic separated from HTTP handling
   - Services use Repositories for data access
   - Can be reused across multiple controllers
   - Examples: UserService, CourseService, QuizService

4. **Dependency Injection (Inversify)**
   - Loose coupling through constructor injection
   - Container modules provide instances
   - Easy mocking for tests
   - Configurable at module level

5. **Validator Pattern**
   - class-validator + class-transformer
   - Request body validation via decorators
   - Type safety through TypeScript interfaces
   - Custom validators for domain-specific rules

6. **Middleware Chain**
   - Global middleware for all requests
   - Module-specific middleware if needed
   - Error handling at the end of chain

---

## Implemented Features by Module

### Module 1: Authentication (auth/)

**Purpose:** Handle user registration, login, and Firebase authentication

**Main Components:**
- **AuthController** - HTTP endpoints for auth operations
- **FirebaseAuthService** - Firebase SDK integration
- **Request Validators:**
  - SignUpBody (email, password, firstName, lastName, etc.)
  - LoginBody (email, password)
  - PasswordResetBody (email)
  - VerifyTokenBody (idToken)

**Implemented Endpoints:**
```
POST /api/auth/signup
  Body: { email, password, firstName, lastName, ... }
  Returns: { userId, email, token }

POST /api/auth/login
  Body: { email, password }
  Returns: { userId, email, token }

POST /api/auth/password-reset
  Body: { email }
  Returns: { success: true }

POST /api/auth/verify-token
  Body: { idToken }
  Returns: { userId, email, claims }

GET /api/auth/me
  (Requires: Bearer token)
  Returns: { user: UserObject }
```

**Database Collections:** None (external to MongoDB, stored in Firebase)

**Key Features:**
- ✅ Firebase email/password authentication
- ✅ Custom JWT token verification
- ✅ Password reset workflow
- ✅ Token validation on protected routes
- ✅ User profile creation on signup

---

### Module 2: Users (users/)

**Purpose:** User profiles, enrollment, progress tracking, and activity logging

**Main Components:**
- **UserController** - User profile operations
- **EnrollmentController** - Enrollment CRUD
- **ProgressController** - Progress tracking and calculation
- **UserActivityEventController** - Activity logging
- **Services:** UserService, EnrollmentService, ProgressService
- **Repositories:** UserRepository, EnrollmentRepository, ProgressRepository, UserActivityEventRepository

**Implemented Endpoints:**
```
GET /api/users
  Returns: [User]

GET /api/users/:userId
  Returns: User

PUT /api/users/:userId
  Body: { firstName, lastName, email, role, ... }
  Returns: User (updated)

GET /api/enrollments/:userId
  Returns: [EnrollmentObject]

POST /api/enrollments
  Body: { userId, courseId }
  Returns: Enrollment (created)

GET /api/progress/:enrollmentId
  Returns: ProgressObject { completed: 8, total: 10, percentage: 80 }

POST /api/activity-events
  Body: { userId, eventType, data }
  Returns: ActivityEvent (created)

GET /api/activity-events/:userId
  Returns: [ActivityEvent]
```

**Database Collections:**
- `users` - User profiles with role, email, name
- `enrollments` - User-course relationships with status
- `userProgress` - Completion tracking per enrollment
- `userActivityEvents` - Activity audit log

**Indexes:**
- users: email (unique), role
- enrollments: userId, courseId (compound), status
- userProgress: enrollmentId (unique)
- userActivityEvents: userId, timestamp (desc)

**Key Features:**
- ✅ User CRUD operations
- ✅ Enrollment management
- ✅ Progress calculation (% complete, next item)
- ✅ Activity event tracking
- ✅ Role-based access control
- ✅ Auto-enrollment status updates

---

### Module 3: Courses (courses/)

**Purpose:** Course creation, management, versioning, and hierarchical content organization

**Main Components:**
- **CourseController** - Course CRUD
- **CourseVersionController** - Version management
- **ModuleController** - Module CRUD
- **SectionController** - Section CRUD
- **ItemController** - Content item CRUD
- **Services:** CourseService, VersionService, ModuleService, SectionService, ItemService
- **Repositories:** Corresponding repositories for each entity

**Data Model (Hierarchical):**
```
Course {
  _id: ObjectId
  title: string
  description: string
  coverImage: URL
  instructor: UserId
  currentVersionId: VersionId
  createdAt: Date
  
  → CourseVersion {
    _id: ObjectId
    courseId: CourseId
    versionNumber: number
    releaseDate: Date
    changelog: string
    
    → Module {
      _id: ObjectId
      versionId: VersionId
      title: string
      description: string
      order: number
      
      → Section {
        _id: ObjectId
        moduleId: ModuleId
        title: string
        description: string
        order: number
        
        → Item {
          _id: ObjectId
          sectionId: SectionId
          title: string
          type: 'video' | 'text' | 'quiz' | 'interactive'
          content: ContentObject
          order: number
          duration: number (minutes)
        }
      }
    }
  }
}
```

**Implemented Endpoints:**
```
GET /api/courses
  Query: { status, category, skip, limit }
  Returns: [Course]

POST /api/courses
  Body: { title, description, coverImage, instructorId }
  Returns: Course (created)

PUT /api/courses/:courseId
  Body: { title, description, ... }
  Returns: Course (updated)

DELETE /api/courses/:courseId
  Returns: { success: true }

GET /api/courses/:courseId/versions
  Returns: [CourseVersion]

POST /api/courses/:courseId/versions
  Body: { versionNumber, changelog }
  Returns: CourseVersion (created)

POST /api/courses/:courseId/modules
  Body: { title, description, order }
  Returns: Module (created)

PUT /api/modules/:moduleId
  Body: { title, order, ... }
  Returns: Module (updated)

POST /api/sections
  Body: { moduleId, title, order }
  Returns: Section (created)

POST /api/items
  Body: { sectionId, title, type, content, order }
  Returns: Item (created)
```

**Database Collections:**
- `courses` - Course metadata
- `courseVersions` - Immutable course versions
- `modules` - Course modules
- `sections` - Sections within modules
- `items` - Content items (videos, text, quizzes, etc.)

**Key Features:**
- ✅ Full CRUD for all hierarchical levels
- ✅ Course versioning (immutable versions)
- ✅ Ordering/sequencing of modules, sections, items
- ✅ Multiple content types support
- ✅ Soft-delete capability
- ✅ Version rollback
- ✅ Bulk operations support

---

### Module 4: Quizzes (quizzes/)

**Purpose:** Quiz and assessment engine with multiple question types and auto-grading

**Main Components:**
- **QuizController** - Quiz CRUD
- **QuestionController** - Question management
- **QuestionBankController** - Question bank organization
- **AttemptController** - Quiz attempt tracking and grading
- **Services:** QuizService, QuestionService, QuestionBankService, AttemptService, GradingService

**Question Types Supported:**
```
SOL (Single Option - Multiple Choice)
  - One correct answer
  - Auto-graded

SML (Single Multiple - Multiple True/False)
  - Each option is true/false
  - Auto-graded

MTL (Multiple True/List - Multiple Selection)
  - Multiple correct answers
  - Auto-graded with partial credit

OTL (One Text Line - Short Answer)
  - Text input
  - Keyword or fuzzy matching grading

NAT (Numerical Answer)
  - Numeric input
  - Range matching

DES (Descriptive - Essay)
  - Long-form text
  - Manual grading by instructor
```

**Quiz Model:**
```
Quiz {
  _id: ObjectId
  title: string
  description: string
  courseId: CourseId
  questions: [QuestionId]
  settings: {
    timeLimit: number (minutes)
    shuffleQuestions: boolean
    shuffleOptions: boolean
    reviewType: 'none' | 'after_submission' | 'after_deadline'
    showAnswers: boolean
    passingScore: number (%)
    maxAttempts: number
    allowPartialCredit: boolean
    useProctoring: boolean
    lockQuestions: boolean
    allowReview: boolean
  }
  createdBy: UserId
  createdAt: Date
}

Question {
  _id: ObjectId
  quizId: QuizId
  type: 'SOL' | 'SML' | 'MTL' | 'OTL' | 'NAT' | 'DES'
  content: string
  options: [Option]  // null for OTL, NAT, DES
  correctAnswer: string | [string]
  explanation: string
  difficulty: 'easy' | 'medium' | 'hard'
  points: number
  order: number
}

QuizAttempt {
  _id: ObjectId
  quizId: QuizId
  userId: UserId
  startTime: Date
  endTime: Date
  answers: [AnswerObject]
  score: number
  percentage: number
  status: 'in-progress' | 'submitted' | 'graded'
  proctorData: ProctorObject (if proctoring enabled)
}

Answer {
  questionId: QuestionId
  userAnswer: string | [string]
  isCorrect: boolean
  points: number
  timeTaken: number (seconds)
}
```

**Implemented Endpoints:**
```
GET /api/quizzes/:quizId
  Returns: Quiz

POST /api/quizzes
  Body: { title, courseId, questions: [QuestionId], settings }
  Returns: Quiz (created)

GET /api/questions
  Query: { quizId, skip, limit }
  Returns: [Question]

POST /api/questions
  Body: { quizId, type, content, options, correctAnswer, ... }
  Returns: Question (created)

POST /api/quiz-attempts
  Body: { quizId, userId }
  Returns: QuizAttempt (created, in-progress)

PUT /api/quiz-attempts/:attemptId
  Body: { questionId, answer }
  Returns: QuizAttempt (updated)

POST /api/quiz-attempts/:attemptId/submit
  Body: (empty or final answers)
  Returns: QuizAttempt (submitted, auto-graded if applicable)

GET /api/quiz-attempts/:attemptId
  Returns: QuizAttempt (with results and feedback)

GET /api/quiz-attempts/:userId/:quizId
  Returns: [QuizAttempt] (all attempts)
```

**Auto-Grading Logic:**
- SOL/SML/MTL: Exact match or fuzzy match (configurable)
- NAT: Numeric range matching (e.g., 5.0 ± 0.1)
- OTL: Keyword matching or regex patterns
- DES: Flag for instructor review (manual grading required)

**Database Collections:**
- `quizzes` - Quiz definitions
- `questions` - Quiz questions
- `questionBanks` - Question bank groupings
- `quizAttempts` - Student quiz attempts
- `answers` - Individual question responses

**Key Features:**
- ✅ 6 question types with appropriate grading
- ✅ Auto-grading for objective questions
- ✅ Partial credit support
- ✅ Question shuffling and option randomization
- ✅ Time-limited attempts
- ✅ Attempt history tracking
- ✅ Detailed feedback per question
- ✅ Pass/fail determination
- ✅ Proctoring integration

---

### Module 5: Notifications (notifications/)

**Purpose:** Email notifications, invitations, and system alerts

**Main Components:**
- **NotificationController** - Notification CRUD
- **MailService** - SMTP integration for email sending
- **InviteController** - Course/system invitations

**Implemented Endpoints:**
```
POST /api/notifications
  Body: { userId, type, subject, message, data }
  Returns: Notification (created, sent)

GET /api/notifications/:userId
  Query: { read, skip, limit }
  Returns: [Notification]

PUT /api/notifications/:notificationId/read
  Returns: Notification (marked as read)

POST /api/invites
  Body: { email, courseId, role, message }
  Returns: Invite (created, email sent)

GET /api/invites/:code
  Returns: Invite (if valid and unused)

POST /api/invites/:code/accept
  Returns: { userId, courseId, enrollment }
```

**Notification Types:**
- Course enrollment
- Quiz submission reminder
- Grade published
- Comment on submission
- System announcements
- Course updates

**Email Templates:**
- Enrollment confirmation
- Quiz attempt confirmation
- Grade notification
- Password reset
- Course invitation

**Database Collections:**
- `notifications` - In-system notifications
- `invites` - Invitation codes

**Key Features:**
- ✅ SMTP email delivery
- ✅ Notification templates
- ✅ Read/unread tracking
- ✅ Bulk email sending
- ✅ Invite code generation
- ✅ Invite acceptance workflow

---

### Module 6: Settings (setting/)

**Purpose:** User and course settings, proctoring configuration

**Main Components:**
- **SettingController** - Settings CRUD

**Implemented Endpoints:**
```
GET /api/settings/user/:userId
  Returns: UserSettings

PUT /api/settings/user/:userId
  Body: { notificationPreferences, theme, language, ... }
  Returns: UserSettings (updated)

GET /api/settings/course/:courseId/proctor
  Returns: ProctorSettings

PUT /api/settings/course/:courseId/proctor
  Body: { enableFaceDetection, enableBehaviorMonitoring, ... }
  Returns: ProctorSettings (updated)
```

**Setting Types:**
```
UserSettings {
  userId: UserId
  notificationPreferences: {
    emailOnGrade: boolean
    emailOnAnnouncement: boolean
    emailOnComments: boolean
  }
  theme: 'light' | 'dark'
  language: 'en' | 'es' | 'fr' | ...
  timezone: string
}

ProctorSettings {
  courseId: CourseId
  enableFaceDetection: boolean
  enableBehaviorMonitoring: boolean
  enableCopyPasteDetection: boolean
  enableTabSwitchDetection: boolean
  faceDetectionThreshold: number (0-1)
  recordSession: boolean (requires consent)
  lockdownBrowser: boolean
}

CourseSettings {
  courseId: CourseId
  enrollmentRequiresApproval: boolean
  allowDropAfterDeadline: boolean
  allowRetakes: boolean
  showAnswersAfterSubmission: boolean
}
```

**Database Collections:**
- `userSettings` - Per-user preferences
- `courseSettings` - Per-course configuration
- `proctorSettings` - Proctoring configuration

**Key Features:**
- ✅ User preference management
- ✅ Proctoring configuration per course
- ✅ Settings inheritance (course defaults)
- ✅ Privacy and notification controls

---

### Module 7: Anomalies (anomalies/)

**Purpose:** Detect and track suspicious patterns in quiz attempts (academic integrity)

**Main Components:**
- **AnomalyController** - Anomaly CRUD, reporting
- **AnomalyService** - Detection logic
- **CloudStorageService** - Evidence file storage

**Anomaly Detection Methods:**

```
1. Face Detection Anomalies
   - Multiple faces detected
   - No face detected
   - Face occluded for extended period
   - Unusual head position or distance

2. Behavior Anomalies
   - Unusual copying pattern
   - Tab switching frequency
   - Window switching frequency
   - Keyboard pattern changes

3. Performance Anomalies
   - Completion time unusually fast
   - Completion time unusually slow
   - Score jump between attempts
   - Answers match other student's > 80%

4. Statistical Anomalies
   - Question response patterns
   - Time distribution across questions
   - Knowledge graph inconsistencies
```

**Anomaly Model:**
```
Anomaly {
  _id: ObjectId
  quizAttemptId: AttemptId
  userId: UserId
  quizId: QuizId
  detectionMethod: string
  confidence: number (0-1)
  severity: 'low' | 'medium' | 'high' | 'critical'
  evidence: {
    videoUrl: string (if recorded)
    screenshots: [URL]
    logs: [LogEntry]
  }
  description: string
  instructorReview: {
    status: 'pending' | 'approved' | 'suspicious' | 'false_positive'
    notes: string
    reviewedBy: UserId
    reviewedAt: Date
  }
  createdAt: Date
}
```

**Implemented Endpoints:**
```
GET /api/anomalies
  Query: { courseId, status, skip, limit }
  Returns: [Anomaly]

GET /api/anomalies/:anomalyId
  Returns: Anomaly (with evidence)

PUT /api/anomalies/:anomalyId/review
  Body: { status, notes }
  Returns: Anomaly (updated)

GET /api/anomalies/quiz/:quizAttemptId
  Returns: [Anomaly] (for specific attempt)

POST /api/anomalies/analyze
  Body: { quizAttemptId }
  Returns: Anomaly (newly created)
```

**Database Collections:**
- `anomalies` - Flagged attempts and evidence
- Stored evidence files in Google Cloud Storage

**Key Features:**
- ✅ Multi-method anomaly detection
- ✅ Confidence scoring
- ✅ Evidence collection (video, screenshots, logs)
- ✅ Instructor review workflow
- ✅ False positive tracking
- ✅ Historical pattern analysis
- ✅ GCS integration for evidence storage

---

### Module 8: GenAI (genAI/)

**Purpose:** Anthropic AI integration for question generation and content assistance

**Main Components:**
- **GenAIController** - AI operation endpoints
- **WebhookController** - Webhook handling for async AI tasks
- **GenAIService** - Anthropic SDK integration

**Implemented Endpoints:**
```
POST /api/genai/generate-questions
  Body: { 
    topic: string
    difficulty: 'easy' | 'medium' | 'hard'
    count: number
    questionTypes: [string]
    courseContext: string
  }
  Returns: { jobId, status }

GET /api/genai/generation-status/:jobId
  Returns: { status, questions: [GeneratedQuestion], progress: number }

POST /api/genai/question-suggestions
  Body: { courseContent, numQuestions, targetAudience }
  Returns: [SuggestedQuestion]

POST /api/genai/content-summary
  Body: { courseModuleId }
  Returns: { summary, keyPoints: [string] }

POST /api/genai/learning-objectives
  Body: { courseContent }
  Returns: [LearningObjective]
```

**Generated Question Structure:**
```
GeneratedQuestion {
  content: string
  type: 'SOL' | 'SML' | 'MTL' | 'OTL' | 'NAT' | 'DES'
  options: [string] (null for some types)
  correctAnswer: string | [string]
  explanation: string
  difficulty: 'easy' | 'medium' | 'hard'
  alignment: {
    learningObjective: string
    bloomLevel: 'remember' | 'understand' | 'apply' | ...
  }
  quality: {
    clarity: number (0-100)
    relevance: number (0-100)
    difficulty_appropriate: number (0-100)
  }
}
```

**Anthropic Integration:**
- Uses Claude API for generation
- Prompting strategy: Few-shot examples, domain-specific instructions
- Rate limiting: Respects API quota and rate limits
- Caching: Stores generated questions for reuse
- Cost tracking: Monitors API usage for billing

**Database Collections:**
- `generatedQuestions` - AI-created questions
- `aiGenerationJobs` - Async job tracking

**Key Features:**
- ✅ Question generation at multiple difficulty levels
- ✅ Multiple question type support
- ✅ Quality scoring on generated content
- ✅ Learning objective alignment
- ✅ Async/job-based processing
- ✅ Webhook support for notifications
- ✅ User approval workflow before adding to quiz
- ✅ Usage tracking and quotas

---

### Module 9: Emotions (emotions/) - RECENTLY ADDED

**Purpose:** Track and analyze learner emotional states during learning

**Main Components:**
- **EmotionController** - Emotion submission and retrieval
- **EmotionService** - Emotion analysis and aggregation
- **EmotionRepository** - Data access

**Emotion States:**
```
Very Sad (😢)     - Frustrated, confused, discouraged
Sad (😟)          - Uncertain, struggling, disengaged
Neutral (😐)      - Neutral, focused, normal progress
Happy (🙂)         - Satisfied, progressing, confident
Very Happy (😄)    - Excited, mastering, engaged
```

**Implemented Endpoints:**
```
POST /api/emotions/submit
  Body: { 
    userId: UserId
    courseId: CourseId
    itemId: ItemId (optional)
    emotion: 'very_sad' | 'sad' | 'neutral' | 'happy' | 'very_happy'
    context: string (optional - notes)
    timestamp: Date
  }
  Returns: EmotionEntry (created)

GET /api/emotions/stats/:courseId
  Query: { startDate, endDate }
  Returns: {
    distribution: { very_sad: 5, sad: 15, neutral: 40, happy: 30, very_happy: 10 }
    trend: [DailyStats]
    riskStudents: [StudentWithLowEmotions]
  }

GET /api/emotions/history/:userId/:courseId
  Query: { skip, limit }
  Returns: [EmotionEntry] (reverse chronological)

GET /api/emotions/report/:courseId
  Returns: EmotionReport {
    courseId
    sentimentTrend: [TrendData]
    itemSentiment: { itemId: emotion_stats }
    studentRisk: [StudentRiskData]
    recommendations: [string]
  }
```

**Data Model:**
```
EmotionEntry {
  _id: ObjectId
  userId: UserId
  courseId: CourseId
  itemId: ItemId (optional)
  emotion: 'very_sad' | 'sad' | 'neutral' | 'happy' | 'very_happy'
  emotionScore: number (-2, -1, 0, 1, 2)
  context: string
  timestamp: Date
  createdAt: Date
}

EmotionStats {
  courseId: CourseId
  distribution: { very_sad: 5%, sad: 15%, neutral: 40%, happy: 30%, very_happy: 10% }
  averageScore: number
  trend: [DailyStat]
  studentsAtRisk: [UserId] (avg emotion < -0.5)
  itemEffectiveness: { itemId: averageEmotionScore }
}
```

**Database Collections:**
- `emotionEntries` - Individual emotion submissions
- `emotionStats` - Aggregated emotion statistics

**Indexes:**
- emotionEntries: userId, courseId, timestamp
- emotionEntries: courseId, timestamp

**Frontend Integration:**
```
Components Implemented:
- EmotionSelector (Quick emotion picker, 5 emoji buttons)
- EmotionAnalyticsDashboard (Charts, trends, statistics)
- ItemEmotionStats (Per-item sentiment display)
- StudentEmotionJourney (Student's emotion history)

Hooks:
- useSubmitEmotion() - Submit emotion entry
- useEmotionStats() - Get course sentiment statistics
- useEmotionHistory() - Fetch emotion history
- useCourseEmotionReport() - Generate emotion report
```

**Key Features:**
- ✅ Real-time emotion capture (non-invasive emoji selector)
- ✅ Emotion aggregation and statistics
- ✅ Sentiment trend analysis
- ✅ At-risk student identification
- ✅ Item-level emotion effectiveness tracking
- ✅ Emotional journey visualization
- ✅ Instructor emotion dashboard
- ✅ Integration with course pages
- ✅ Historical trend analysis
- ✅ Recommendations for struggling students

---

### Module 10: HP System (hpSystem/) - Gamification

**Purpose:** Points/HP system, achievements, leaderboards, and engagement rewards

**Main Components:**
- **ActivityController** - Activity CRUD
- **ActivitySubmissionsController** - Submission tracking
- **LedgerController** - HP ledger and transactions
- **RuleConfigsController** - Rule management
- **CohortsController** - Cohort management for competitions
- **Services:** HPService, LeaderboardService, AchievementService

**HP System Model:**
```
Activity {
  _id: ObjectId
  courseId: CourseId
  name: string
  description: string
  points: number
  type: 'quiz' | 'assignment' | 'participation' | 'custom'
  requirements: {
    minScore: number (%)
    minAttempts: number
    dueDate: Date
  }
}

ActivitySubmission {
  _id: ObjectId
  activityId: ActivityId
  userId: UserId
  submissionDate: Date
  result: {
    score: number
    passed: boolean
  }
  pointsEarned: number
}

HPLedger {
  _id: ObjectId
  userId: UserId
  courseId: CourseId
  totalHP: number
  transactions: [HPTransaction]
  achievements: [Achievement]
  rank: number
  percentile: number
}

HPTransaction {
  date: Date
  activityId: ActivityId
  pointsChange: number (positive or negative)
  reason: string
  balance: number (after transaction)
}

Achievement {
  _id: ObjectId
  name: string
  description: string
  icon: URL
  pointReward: number
  unlockCondition: {
    type: 'points' | 'quiz_passed' | 'course_completed' | 'streak'
    value: number
  }
  unlockedAt: Date
}
```

**Implemented Endpoints:**
```
GET /api/activities/:courseId
  Returns: [Activity]

POST /api/activities
  Body: { courseId, name, points, type, requirements }
  Returns: Activity (created)

PUT /api/activities/:activityId
  Body: { name, points, requirements, ... }
  Returns: Activity (updated)

GET /api/hp-ledger/:userId/:courseId
  Returns: HPLedger { totalHP, transactions, achievements, rank }

GET /api/leaderboard/:courseId
  Query: { limit, skip }
  Returns: [LeaderboardEntry] (sorted by HP desc)

GET /api/achievements/:userId/:courseId
  Returns: [Achievement] (unlocked)

POST /api/achievements/:achievementId/unlock
  Returns: Achievement (if conditions met)

PUT /api/cohorts
  Body: { courseId, name, members: [userId] }
  Returns: Cohort
```

**Database Collections:**
- `activities` - Activity definitions
- `activitySubmissions` - Submission records
- `hpLedgers` - User HP and achievement tracking
- `achievements` - Achievement definitions
- `cohorts` - User groupings for competitions

**Key Features:**
- ✅ Point/HP reward system
- ✅ Multiple activity types
- ✅ Achievement unlocking
- ✅ Leaderboards (global and cohort-based)
- ✅ Rank and percentile tracking
- ✅ HP transaction history
- ✅ Streak tracking
- ✅ Cohort competitions
- ✅ Configurable rules and rewards
- ✅ Real-time leaderboard updates

---

### Modules 11-16 (Summary)

**Module 11: Announcements (announcements/)**
- Course-level announcements
- Create, read, mark as read
- Rich text editor support
- Notification integration

**Module 12: Audit Trails (auditTrails/)**
- Logs all data mutations
- User action tracking
- Compliance and audit support
- Timestamp and actor tracking

**Module 13: Reports (reports/)**
- Course performance reports
- Student progress reports
- Emotion analytics reports
- Anomaly summary reports
- Export to PDF/CSV

**Module 14: Projects (projects/)**
- Student project assignments
- Submission tracking
- File upload support
- Grading workflow

**Module 15: Course Registration (courseRegistration/)**
- Self-service enrollment
- Approval workflows
- Bulk enrollment
- Registration status tracking

**Module 16: Ejection Policy (ejectionPolicy/)**
- Rules for removing students
- Automated policy enforcement
- Appeal workflow
- Compliance tracking

---

## Frontend Implementation

### Technology Stack

- **Framework:** React 18+
- **Build Tool:** Vite (hot reload, fast builds)
- **Routing:** TanStack Router v1.46.1
- **State Management:** TanStack React Query v5+ (server state), Context API (UI state)
- **UI Library:** shadcn/ui (Tailwind CSS components)
- **Styling:** Tailwind CSS v3
- **HTTP Client:** Fetch API (with custom wrapper)
- **Forms:** React Hook Form + Zod validation
- **Machine Learning:** MediaPipe + TensorFlow.js (for face detection)
- **Rich Text:** Yoopta editor
- **PDF Export:** React PDF Renderer
- **Charts:** Recharts (for analytics/emotion dashboards)
- **JSON Schema Forms:** @rjsf (dynamic form generation)

### Page Structure

```
src/
├── pages/
│   ├── (auth)/
│   │   ├── login.tsx
│   │   ├── signup.tsx
│   │   └── password-reset.tsx
│   ├── (student)/
│   │   ├── dashboard.tsx
│   │   ├── courses/
│   │   │   ├── [courseId]/
│   │   │   │   ├── index.tsx (course details)
│   │   │   │   ├── [moduleId]/
│   │   │   │   │   └── [sectionId]/
│   │   │   │   │       └── [itemId]/index.tsx
│   │   │   │   └── quiz/[quizId].tsx
│   │   ├── progress.tsx
│   │   ├── quizzes/[quizId].tsx (quiz taking interface)
│   │   └── emotions.tsx (emotion tracking)
│   ├── (teacher)/
│   │   ├── dashboard.tsx
│   │   ├── courses/[courseId]/
│   │   │   ├── manage.tsx
│   │   │   ├── content-builder.tsx
│   │   │   ├── quiz-builder.tsx
│   │   │   ├── enrollments.tsx
│   │   │   ├── grading.tsx
│   │   │   ├── analytics.tsx
│   │   │   └── emotions.tsx (emotion dashboard)
│   │   └── ai-tools.tsx
│   ├── (admin)/
│   │   ├── dashboard.tsx
│   │   ├── users.tsx
│   │   ├── courses.tsx
│   │   └── settings.tsx
│   └── 404.tsx
│
├── components/
│   ├── layout/
│   │   ├── RootLayout.tsx
│   │   ├── Navbar.tsx
│   │   └── Sidebar.tsx
│   ├── course/
│   │   ├── CourseCard.tsx
│   │   ├── CourseHierarchy.tsx
│   │   └── CourseBuilder.tsx
│   ├── quiz/
│   │   ├── QuizInterface.tsx
│   │   ├── QuestionDisplay.tsx
│   │   ├── Timer.tsx
│   │   ├── QuizResults.tsx
│   │   └── QuestionBank.tsx
│   ├── emotion/
│   │   ├── EmotionSelector.tsx (5 emoji buttons)
│   │   ├── EmotionAnalyticsDashboard.tsx
│   │   ├── ItemEmotionStats.tsx
│   │   ├── StudentEmotionJourney.tsx
│   │   └── EmotionTrendChart.tsx
│   ├── proctoring/
│   │   ├── FaceDetector.tsx
│   │   └── ProctorWarnings.tsx
│   ├── gamification/
│   │   ├── LeaderboardDisplay.tsx
│   │   ├── AchievementCard.tsx
│   │   └── HPDisplay.tsx
│   └── common/
│       ├── Button.tsx
│       ├── Modal.tsx
│       ├── Form.tsx
│       └── LoadingSpinner.tsx
│
├── hooks/
│   ├── useAuth.ts (authentication context)
│   ├── useCourse.ts (course data fetching)
│   ├── useQuiz.ts (quiz state)
│   ├── useSubmitEmotion.ts (emotion submission)
│   ├── useEmotionStats.ts (emotion statistics)
│   ├── useEmotionHistory.ts (emotion history)
│   ├── useCourseEmotionReport.ts (emotion report)
│   ├── useProctoring.ts (proctoring state)
│   ├── useAnomalies.ts (anomaly detection)
│   └── useUser.ts (user profile)
│
├── lib/
│   ├── api-client.ts (HTTP wrapper)
│   ├── auth.ts (Firebase setup)
│   ├── constants.ts
│   └── utils.ts
│
├── types/
│   ├── schema.ts (OpenAPI-generated types)
│   ├── auth.ts
│   ├── course.ts
│   ├── quiz.ts
│   └── emotion.ts
│
├── App.tsx (Router setup)
└── main.tsx
```

### Key Components in Detail

**EmotionSelector Component:**
```tsx
export function EmotionSelector() {
  return (
    <div className="flex gap-4 justify-center">
      <button onClick={() => submitEmotion('very_sad')} title="Very Sad">😢</button>
      <button onClick={() => submitEmotion('sad')} title="Sad">😟</button>
      <button onClick={() => submitEmotion('neutral')} title="Neutral">😐</button>
      <button onClick={() => submitEmotion('happy')} title="Happy">🙂</button>
      <button onClick={() => submitEmotion('very_happy')} title="Very Happy">😄</button>
    </div>
  )
}
```

**useSubmitEmotion Hook:**
```tsx
export function useSubmitEmotion(courseId: string) {
  const mutation = useMutation({
    mutationFn: (emotion: EmotionState) =>
      api.post('/emotions/submit', { courseId, emotion, timestamp: new Date() }),
    onSuccess: (data) => {
      // Show success toast
      queryClient.invalidateQueries({ queryKey: ['emotion-stats', courseId] })
    }
  })
  return mutation
}
```

---

## Deployment & Infrastructure

### Docker Build Configuration

**Backend Dockerfile (Multi-stage):**
```dockerfile
# Stage 1: Build
FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm@10.12.1
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm run build

# Stage 2: Runtime
FROM node:22-alpine
WORKDIR /app
RUN npm install -g pnpm@10.12.1
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --prod --frozen-lockfile
COPY --from=builder /app/build ./build
EXPOSE 8080
CMD ["node", "build/index.js"]
```

**Frontend Dockerfile (Multi-stage):**
```dockerfile
# Stage 1: Build
FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm@10.12.1
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm run build

# Stage 2: Serve
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

### Deployment Targets

**Frontend:**
- Target: Firebase Hosting
- Environments: Staging (preview) + Production
- Custom domain support
- SSL/TLS automatic
- Configuration: firebase.json

**Backend:**
- Target: Google Cloud Run
- Containerization: Docker
- Environment: Node.js 22-alpine
- Auto-scaling: 0-100 instances
- Memory: 2GB per instance
- Timeout: 3600 seconds (1 hour)

**Database:**
- MongoDB Atlas (managed cloud)
- Region: us-east-1 (primary)
- Backup: Automated daily
- Replica set: 3-node cluster
- Collections: 20+ (dynamically indexed)

**Storage:**
- Google Cloud Storage (for media, evidence)
- Bucket: vibe-media-files
- Lifecycle: Automatic archival after 90 days
- Public: No (signed URLs only)

### CI/CD Pipeline (GitHub Actions)

**Workflow:** `.github/workflows/deploy.yml`

```yaml
name: Deploy to GCP

on:
  push:
    branches: [main, develop]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '22'
      - run: npm install -g pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm run test
      - run: pnpm run lint

  build-backend:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: docker build -t gcr.io/${{ secrets.GCP_PROJECT }}/vibe-backend:${{ github.sha }} backend/
      - run: docker push gcr.io/${{ secrets.GCP_PROJECT }}/vibe-backend:${{ github.sha }}

  build-frontend:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: docker build -t gcr.io/${{ secrets.GCP_PROJECT }}/vibe-frontend:${{ github.sha }} frontend/
      - run: docker push gcr.io/${{ secrets.GCP_PROJECT }}/vibe-frontend:${{ github.sha }}

  deploy:
    needs: [build-backend, build-frontend]
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to Cloud Run
        run: |
          gcloud run deploy vibe-backend \
            --image gcr.io/${{ secrets.GCP_PROJECT }}/vibe-backend:${{ github.sha }} \
            --platform managed \
            --region us-central1
      
      - name: Deploy to Firebase Hosting
        run: |
          firebase deploy --only hosting \
            --token ${{ secrets.FIREBASE_TOKEN }}
```

### Environment Configuration

**Backend Environment Variables:**
```
NODE_ENV=production
PORT=8080
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/vibe
FIREBASE_PROJECT_ID=vibe-prod
FIREBASE_PRIVATE_KEY=...
GOOGLE_CLOUD_STORAGE_BUCKET=vibe-media-files
ANTHROPIC_API_KEY=sk-ant-...
SENTRY_DSN=https://...
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=noreply@vibe.com
SMTP_PASSWORD=...
JWT_SECRET=...
RATE_LIMIT_ENABLED=true
RATE_LIMIT_WINDOW=15m
RATE_LIMIT_MAX_REQUESTS=100
```

**Frontend Environment Variables:**
```
VITE_API_URL=https://api.vibe.com
VITE_FIREBASE_PROJECT_ID=vibe-prod
VITE_FIREBASE_API_KEY=AIzaSy...
VITE_FIREBASE_AUTH_DOMAIN=vibe-prod.firebaseapp.com
VITE_ENVIRONMENT=production
```

---

## Development Setup

### Prerequisites

- Node.js 22 LTS
- pnpm 10.12.1+ (package manager)
- MongoDB 6.0+ (local or Atlas)
- Docker (optional, for containerization)
- Firebase CLI (for local emulation)
- Git (version control)

### Local Development Setup

**Step 1: Clone Repository**
```bash
git clone https://github.com/vibe/vibe.git
cd vibe
```

**Step 2: Install Dependencies**
```bash
pnpm install  # Installs all workspace packages
```

**Step 3: Setup Environment Variables**
```bash
# Backend
cp backend/.env.example backend/.env
# Fill in MONGODB_URI, Firebase keys, etc.

# Frontend
cp frontend/.env.example frontend/.env
# Fill in API URL, Firebase config, etc.
```

**Step 4: Start MongoDB Locally**
```bash
# Option 1: Using Docker
docker run -d -p 27017:27017 --name mongodb mongo:7

# Option 2: Existing MongoDB installation
mongod --dbpath /path/to/data
```

**Step 5: Run Database Migrations (if any)**
```bash
pnpm run migrate
```

**Step 6: Start Development Servers**
```bash
# In separate terminals:

# Terminal 1: Backend development server
cd backend
pnpm run dev

# Terminal 2: Frontend development server
cd frontend
pnpm run dev

# Terminal 3: E2E tests (optional)
cd e2e
pnpm run test:ui
```

**Access Points:**
- Frontend: http://localhost:5173
- Backend API: http://localhost:8080 (or :4001)
- API Documentation: http://localhost:8080/api-docs

### Project Structure

```
vibe/
├── backend/              # Express.js API server
│   ├── src/
│   │   ├── index.ts     # Entry point
│   │   ├── container.ts # DI container setup
│   │   ├── modules/     # 16 backend modules
│   │   ├── shared/      # Shared utilities
│   │   ├── config/      # Configuration files
│   │   └── workers/     # Background jobs
│   ├── build/           # Compiled JavaScript
│   ├── vite.config.ts   # Vitest configuration
│   └── package.json
│
├── frontend/            # React Vite SPA
│   ├── src/
│   │   ├── pages/      # Route pages
│   │   ├── components/ # React components
│   │   ├── hooks/      # Custom React hooks
│   │   ├── lib/        # Utilities
│   │   ├── types/      # TypeScript types
│   │   └── App.tsx     # Root component
│   ├── dist/           # Built assets
│   ├── vite.config.ts  # Vite configuration
│   └── package.json
│
├── cli/                 # Command-line tool (pnpm run vibe <command>)
│   ├── src/
│   │   ├── cli.ts      # CLI entry point
│   │   ├── commands/   # Command implementations
│   │   └── steps/      # Reusable command steps
│   └── package.json
│
├── e2e/                 # Playwright E2E tests
│   ├── tests/          # Test suites
│   ├── playwright.config.ts
│   └── package.json
│
├── docs/                # Docusaurus documentation
│   ├── docs/           # Markdown documentation
│   ├── blog/           # Blog posts
│   └── docusaurus.config.ts
│
├── mcp/                 # Model Context Protocol server
│   └── package.json
│
├── backend/functions/   # Serverless functions (GCP Cloud Functions)
│   └── package.json
│
├── pnpm-workspace.yaml  # Workspace configuration
├── package.json         # Root package definition
└── README.md
```

### Package Manager Setup

**pnpm Workspace:**
```yaml
# pnpm-workspace.yaml
packages:
  - 'frontend'
  - 'backend'
  - 'cli'
  - 'e2e'
  - 'docs'
  - 'mcp'
  - 'backend/functions'
```

**Usage:**
```bash
pnpm install                      # Install all workspaces
pnpm run build                    # Build all packages
pnpm --filter backend run build   # Build specific package
pnpm add axios                    # Add to all packages
pnpm add -w axios                 # Add to root only
```

---

## API Specifications

### OpenAPI/Scalar Integration

The backend automatically generates OpenAPI v3.0 specification from routing-controllers decorators.

**Access:** `GET /api-docs` or `GET /openapi.json`

**Example Controller (Auto-Documenting):**
```typescript
@JsonController('/api/courses')
export class CourseController {
  constructor(
    @Inject(CourseService) private courseService: CourseService
  ) {}

  @Get('/:courseId')
  @HttpCode(200)
  @OnUndefined(404)
  async getCourse(
    @Param('courseId') courseId: string,
    @CurrentUser() user: UserObject
  ): Promise<CourseObject> {
    return this.courseService.findById(courseId);
  }

  @Post('/')
  @HttpCode(201)
  async createCourse(
    @Body() body: CreateCourseBody,
    @CurrentUser() user: UserObject
  ): Promise<CourseObject> {
    return this.courseService.create(body);
  }
}
```

**Generated OpenAPI:**
```json
{
  "paths": {
    "/api/courses/{courseId}": {
      "get": {
        "operationId": "CourseController.getCourse",
        "parameters": [
          { "name": "courseId", "in": "path", "required": true, "schema": { "type": "string" } }
        ],
        "responses": {
          "200": { "description": "Success", "content": { "application/json": { "schema": { "$ref": "#/components/schemas/CourseObject" } } } },
          "404": { "description": "Not Found" }
        }
      }
    }
  }
}
```

### Authentication

**Authorization Header:**
```
Authorization: Bearer <idToken>
```

**Token Validation:**
- Firebase verifies signature
- Extracted from Authorization header
- Middleware validates before controller access
- User object injected via `@CurrentUser()` decorator

**Error Response (401 Unauthorized):**
```json
{
  "statusCode": 401,
  "message": "Invalid or missing authorization token",
  "error": "Unauthorized"
}
```

### Rate Limiting

**Configurable Per Route:**
```typescript
@Get('/')
@RateLimit(100, '15m')  // 100 requests per 15 minutes
async getQuizzes() { ... }
```

**Default:** 1,000 requests per 15 minutes per IP

### Error Handling

**Standard Error Response:**
```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "errors": [
    { "field": "title", "message": "Title is required" }
  ],
  "error": "BadRequest"
}
```

**HTTP Status Codes:**
- 200 OK - Success
- 201 Created - Resource created
- 204 No Content - Success, no response body
- 400 Bad Request - Validation error
- 401 Unauthorized - Missing/invalid auth
- 403 Forbidden - Insufficient permissions
- 404 Not Found - Resource not found
- 409 Conflict - Duplicate resource
- 422 Unprocessable Entity - Business logic error
- 429 Too Many Requests - Rate limit exceeded
- 500 Internal Server Error - Unexpected error
- 503 Service Unavailable - Maintenance/down

---

## Testing Architecture

### Backend Testing (Vitest)

**Test Structure:**
```bash
backend/src/
├── modules/
│   └── courses/
│       ├── course.service.ts
│       ├── course.service.test.ts
│       ├── course.controller.ts
│       └── course.controller.test.ts
└── shared/
    └── __tests__/
        ├── auth.test.ts
        └── database.test.ts
```

**Unit Test Example:**
```typescript
describe('CourseService', () => {
  let service: CourseService;
  let repository: CourseRepository;

  beforeEach(() => {
    repository = mock(CourseRepository);
    service = new CourseService(repository);
  });

  it('should create a course', async () => {
    const body = { title: 'Math 101', instructorId: 'user1' };
    const result = await service.create(body);
    expect(result.title).toBe('Math 101');
    expect(repository.create).toHaveBeenCalledWith(body);
  });
});
```

**Running Tests:**
```bash
pnpm run test              # Run all tests
pnpm run test:watch       # Watch mode
pnpm run test:coverage    # With coverage report
```

### E2E Testing (Playwright)

**Test Structure:**
```bash
e2e/tests/
├── auth/
│   ├── login.spec.ts
│   └── signup.spec.ts
├── courses/
│   ├── create-course.spec.ts
│   └── take-quiz.spec.ts
└── common-utils.ts
```

**E2E Test Example:**
```typescript
test('Student can enroll and take a quiz', async ({ page }) => {
  // 1. Login
  await page.goto('http://localhost:5173/login');
  await page.fill('[data-testid=email]', 'student@example.com');
  await page.fill('[data-testid=password]', 'password123');
  await page.click('[data-testid=login-button]');
  
  // 2. Browse courses
  await page.goto('http://localhost:5173/courses');
  await page.click('text=Math 101');
  
  // 3. Enroll
  await page.click('[data-testid=enroll-button]');
  
  // 4. Take quiz
  await page.click('[data-testid=take-quiz]');
  await page.click('label:has-text("Option A")');
  await page.click('[data-testid=next-question]');
  
  // 5. Submit
  await page.click('[data-testid=submit-quiz]');
  
  // 6. Verify results
  await expect(page.locator('[data-testid=score]')).toContainText('85%');
});
```

**Running E2E Tests:**
```bash
pnpm run test              # Headless mode
pnpm run test:ui           # UI mode with visual debugging
pnpm run test:debug        # Single test with debugger
```

---

## Actual Code Examples from Codebase

### Module Index Pattern (Used by All 16 Modules)

**Example: quizzes/index.ts**
```typescript
import { Container } from 'inversify';
import { QuizController } from './controllers/quiz.controller';
import { QuestionController } from './controllers/question.controller';
import { QuestionBankController } from './controllers/question-bank.controller';
import { AttemptController } from './controllers/attempt.controller';
import { QuizService } from './services/quiz.service';
import { QuestionService } from './services/question.service';
import { AttemptService } from './services/attempt.service';
import { QuizRepository } from './repositories/quiz.repository';
import { QuestionRepository } from './repositories/question.repository';
import { AttemptRepository } from './repositories/attempt.repository';
import * as QuizValidators from './validators';

const container = new Container();

// Register repositories
container.bind(QuizRepository).toSelf();
container.bind(QuestionRepository).toSelf();
container.bind(AttemptRepository).toSelf();

// Register services
container.bind(QuizService).toSelf();
container.bind(QuestionService).toSelf();
container.bind(AttemptService).toSelf();

// Register controllers
container.bind(QuizController).toSelf();
container.bind(QuestionController).toSelf();
container.bind(QuestionBankController).toSelf();
container.bind(AttemptController).toSelf();

export const ModuleControllers = [
  QuizController,
  QuestionController,
  QuestionBankController,
  AttemptController
];

export const ModuleValidators = [
  QuizValidators.CreateQuizBody,
  QuizValidators.UpdateQuizBody,
  QuizValidators.CreateQuestionBody,
  QuizValidators.SubmitAnswerBody,
  // ... more validators
];

export const QuizzesModule = {
  controllers: ModuleControllers,
  validators: ModuleValidators,
  container
};

export default container;
```

### Service Pattern Example

**Example: courses/services/course.service.ts**
```typescript
import { injectable, inject } from 'inversify';
import { CourseRepository } from '../repositories/course.repository';
import { CourseObject } from '../types';

@injectable()
export class CourseService {
  constructor(
    @inject(CourseRepository) 
    private courseRepository: CourseRepository
  ) {}

  async create(data: CreateCourseDto): Promise<CourseObject> {
    // Validate
    if (!data.title || !data.instructorId) {
      throw new ValidationError('Title and instructor are required');
    }
    
    // Create
    const course = await this.courseRepository.create({
      ...data,
      createdAt: new Date(),
      versions: []
    });
    
    // Log audit trail
    await this.auditService.log('COURSE_CREATED', course._id, data);
    
    return course;
  }

  async findById(courseId: string): Promise<CourseObject | null> {
    return this.courseRepository.findById(courseId);
  }

  async update(courseId: string, data: UpdateCourseDto): Promise<CourseObject> {
    const course = await this.courseRepository.findByIdAndUpdate(courseId, data);
    if (!course) throw new NotFoundError('Course not found');
    return course;
  }

  async delete(courseId: string): Promise<void> {
    await this.courseRepository.softDelete(courseId);
  }

  async getWithContent(courseId: string): Promise<CourseWithContent> {
    const course = await this.courseRepository.findById(courseId);
    const modules = await this.moduleRepository.findByCourseId(courseId);
    const sections = await Promise.all(
      modules.map(m => this.sectionRepository.findByModuleId(m._id))
    );
    return { course, modules, sections };
  }
}
```

### Controller Pattern Example

**Example: quizzes/controllers/quiz.controller.ts**
```typescript
import { JsonController, Post, Get, Put, Delete, Body, Param, CurrentUser, HttpCode } from 'routing-controllers';
import { injectable, inject } from 'inversify';
import { QuizService } from '../services/quiz.service';
import { CreateQuizBody, UpdateQuizBody } from '../validators';
import { UserObject } from '#shared/types';

@injectable()
@JsonController('/api/quizzes')
export class QuizController {
  constructor(
    @inject(QuizService) private quizService: QuizService
  ) {}

  @Get('/:quizId')
  @HttpCode(200)
  async getQuiz(
    @Param('quizId') quizId: string,
    @CurrentUser() user: UserObject
  ) {
    return this.quizService.findById(quizId);
  }

  @Post('/')
  @HttpCode(201)
  async createQuiz(
    @Body() body: CreateQuizBody,
    @CurrentUser() user: UserObject
  ) {
    return this.quizService.create({
      ...body,
      createdBy: user.id
    });
  }

  @Put('/:quizId')
  @HttpCode(200)
  async updateQuiz(
    @Param('quizId') quizId: string,
    @Body() body: UpdateQuizBody,
    @CurrentUser() user: UserObject
  ) {
    return this.quizService.update(quizId, body);
  }

  @Delete('/:quizId')
  @HttpCode(204)
  async deleteQuiz(
    @Param('quizId') quizId: string,
    @CurrentUser() user: UserObject
  ) {
    return this.quizService.delete(quizId);
  }
}
```

### Repository Pattern Example

**Example: quizzes/repositories/quiz.repository.ts**
```typescript
import { injectable, inject } from 'inversify';
import { Db, ObjectId, Filter } from 'mongodb';
import { BaseRepository } from '#shared/classes/base.repository';
import { Quiz, CreateQuizDto, UpdateQuizDto } from '../types';

@injectable()
export class QuizRepository extends BaseRepository<Quiz> {
  constructor(@inject('Database') private db: Db) {
    super(db.collection('quizzes'));
  }

  async findByCourseId(courseId: string): Promise<Quiz[]> {
    return this.collection
      .find({ courseId: new ObjectId(courseId) })
      .sort({ createdAt: -1 })
      .toArray();
  }

  async findActive(): Promise<Quiz[]> {
    return this.collection
      .find({ deleted: false })
      .toArray();
  }

  async create(data: CreateQuizDto): Promise<Quiz> {
    const quiz = {
      ...data,
      courseId: new ObjectId(data.courseId),
      createdAt: new Date(),
      updatedAt: new Date(),
      deleted: false
    };
    const result = await this.collection.insertOne(quiz as any);
    return { ...quiz, _id: result.insertedId } as Quiz;
  }

  async findByIdAndUpdate(id: string, data: UpdateQuizDto): Promise<Quiz | null> {
    return this.collection.findOneAndUpdate(
      { _id: new ObjectId(id), deleted: false },
      { 
        $set: { 
          ...data, 
          updatedAt: new Date() 
        } 
      },
      { returnDocument: 'after' }
    );
  }

  async softDelete(id: string): Promise<void> {
    await this.collection.updateOne(
      { _id: new ObjectId(id) },
      { $set: { deleted: true, deletedAt: new Date() } }
    );
  }
}
```

### Validator Pattern Example

**Example: quizzes/validators/index.ts**
```typescript
import { IsString, IsArray, IsNumber, IsBoolean, IsEnum, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export enum QuestionType {
  SOL = 'SOL',
  SML = 'SML',
  MTL = 'MTL',
  OTL = 'OTL',
  NAT = 'NAT',
  DES = 'DES'
}

export class CreateQuestionDto {
  @IsString()
  quizId: string;

  @IsEnum(QuestionType)
  type: QuestionType;

  @IsString()
  content: string;

  @IsArray()
  @IsString({ each: true })
  options: string[];

  @IsString()
  correctAnswer: string;

  @IsString()
  explanation: string;

  @IsNumber()
  points: number = 1;
}

export class CreateQuizBody {
  @IsString()
  title: string;

  @IsString()
  description: string;

  @IsString()
  courseId: string;

  @IsArray()
  @IsString({ each: true })
  questions: string[];

  @ValidateNested()
  @Type(() => QuizSettingsDto)
  settings: QuizSettingsDto;
}

export class QuizSettingsDto {
  @IsNumber()
  timeLimit: number;

  @IsBoolean()
  shuffleQuestions: boolean = false;

  @IsBoolean()
  shuffleOptions: boolean = false;

  @IsNumber()
  passingScore: number = 70;
}
```

---

## Code Generation & Scaffolding

### Plop Templates

The CLI tool supports code generation for new modules using Plop.js.

**Generate New Controller:**
```bash
pnpm run vibe generate:controller courses CourseReview
```

This creates:
- `backend/src/modules/courses/controllers/course-review.controller.ts`
- `backend/src/modules/courses/services/course-review.service.ts`
- `backend/src/modules/courses/repositories/course-review.repository.ts`
- `backend/src/modules/courses/types/index.ts` (updated with new types)

**Generate New Module:**
```bash
pnpm run vibe generate:module feedback
```

This creates a complete new module structure:
```
backend/src/modules/feedback/
├── controllers/
├── services/
├── repositories/
├── validators/
├── types/
├── __tests__/
└── index.ts
```

---

## Monitoring & Observability

### Sentry Integration

**Setup:**
```typescript
import * as Sentry from "@sentry/node";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 1.0,
  integrations: [
    new Sentry.Integrations.OnUncaughtException(),
    new Sentry.Integrations.OnUnhandledRejection()
  ]
});
```

**Error Tracking:**
- All unhandled exceptions captured
- Performance monitoring enabled
- Custom breadcrumbs for key operations
- User context included

**Metrics Tracked:**
- API response times (per endpoint)
- Error rates
- Database query performance
- External API calls
- Session duration
- Feature usage

### Firebase Analytics

**Events Tracked:**
```
login
signup
course_enrolled
course_completed
quiz_submitted
quiz_passed
quiz_failed
emotion_submitted
anomaly_detected
payment_processed
```

---

## Security Considerations

### Authentication & Authorization

- **Primary Auth:** Firebase Email/Password
- **Token:** JWT with 24-hour expiry
- **Refresh:** Via Firebase refresh tokens
- **RBAC:** Role-based access control (Student, Instructor, Admin, Superadmin)

### Data Protection

- **At Rest:** MongoDB encryption (AES-256)
- **In Transit:** TLS 1.3 for all connections
- **Sensitive Fields:** Hashed (passwords), encrypted (SSN, financial data)
- **PII:** Redacted from logs

### API Security

- **CORS:** Whitelist configured origins
- **Rate Limiting:** 1000 req/15min per IP (configurable)
- **Input Validation:** All inputs validated before processing
- **SQL Injection Prevention:** Parameterized queries (MongoDB native)
- **XSS Prevention:** Input sanitization, output encoding
- **CSRF:** Token-based protection (optional for stateless API)

### Compliance

- **FERPA:** Student education records protection
- **GDPR:** Data privacy for EU users
- **CCPA:** Consumer privacy rights for CA residents
- **SOC 2:** Audit controls, access logging, encryption

---

## Performance Optimization

### Backend

**Caching:**
- Redis for session/user data (optional)
- MongoDB indexes on frequently queried fields
- HTTP caching headers for static assets

**Database:**
- Indexed queries: email (unique), courseId, userId
- Aggregation pipelines for complex queries
- Connection pooling (MongoDB Atlas)

**API:**
- Pagination (default 20, max 100 items)
- Field filtering (select specific fields)
- Lazy loading of related data

### Frontend

**Bundle Optimization:**
- Code splitting per route
- Lazy loading of components
- Tree-shaking unused code
- Minification and compression

**Rendering:**
- React.memo for expensive components
- useCallback for stable references
- Virtual scrolling for large lists

**Data Fetching:**
- TanStack Query for caching
- Request deduplication
- Optimistic updates
- Background refetching

---

## Known Issues & Limitations

1. **Video Hosting:** Currently only supports MP4 uploaded to GCS. HLS/streaming not implemented.
2. **Proctoring:** Face detection accuracy varies with lighting conditions. Non-intrusive approach may miss some cheating.
3. **Mobile Support:** Responsive design but no native apps. Best on desktop/tablet.
4. **Offline Mode:** Not supported. Requires internet connection.
5. **AI Questions:** Quality depends on Anthropic API performance. Some generated questions may need instructor review.
6. **Concurrent Edits:** No real-time collaboration on course content. Last-write-wins conflict resolution.
7. **Database:** MongoDB only. SQL database support future phase.
8. **Internationalization:** English primary. Other languages partially localized.

---

## Future Roadmap (Aspirational, Not Committed)

### Phase 2 Enhancements (3-6 months out)

- **Native Mobile Apps** - iOS/Android for student access
- **Real-time Collaboration** - Simultaneous course editing
- **Advanced Proctoring** - Gaze tracking, behavior biometrics
- **Adaptive Learning** - Difficulty adjustment based on performance
- **More Question Types** - Code submission, audio/video response

### Phase 3+ (6+ months out)

- **LMS Integrations** - Canvas, Blackboard, Moodle deep integration
- **Microservices Architecture** - Split into separate services
- **Kubernetes Deployment** - Helm charts for easy deployment
- **SQL Database Support** - PostgreSQL/MySQL option
- **Custom ML Models** - Fine-tuned anomaly detection
- **Blockchain Credentials** - Verifiable digital certificates

---

## Appendix: Complete Module Checklist

```
Backend Modules (16 Total):
✅ 1. auth/ - Authentication and user registration
✅ 2. users/ - User profiles and enrollment
✅ 3. courses/ - Course management and hierarchy
✅ 4. quizzes/ - Quiz engine and auto-grading
✅ 5. notifications/ - Email and system notifications
✅ 6. settings/ - User and course settings
✅ 7. anomalies/ - Anomaly detection and proctoring
✅ 8. genAI/ - Anthropic AI integration
✅ 9. emotions/ - Learner emotion tracking
✅ 10. hpSystem/ - Gamification system
✅ 11. announcements/ - Course announcements
✅ 12. auditTrails/ - Compliance audit logging
✅ 13. reports/ - Analytics and reporting
✅ 14. projects/ - Student project submissions
✅ 15. courseRegistration/ - Enrollment workflows
✅ 16. ejectionPolicy/ - Student removal rules

Shared Infrastructure:
✅ - Database utilities and connection management
✅ - Authentication/authorization utilities
✅ - Base classes for services/repositories/controllers
✅ - Global middleware (logging, error handling)
✅ - Type definitions and interfaces
✅ - Helper functions and constants

Frontend:
✅ - React SPA with Vite
✅ - 8+ page types (auth, student, teacher, admin)
✅ - 30+ reusable components
✅ - Emotion tracking UI (NEW)
✅ - Quiz interface with proctoring
✅ - Analytics dashboards
✅ - E2E test suite with Playwright

DevOps:
✅ - Docker containerization
✅ - GitHub Actions CI/CD
✅ - Firebase Hosting deployment
✅ - Google Cloud Run backend
✅ - MongoDB Atlas integration
✅ - Sentry monitoring
```

---

## Document Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1 | Apr 20, 2026 | Initial draft - aspirational | Product Team |
| 0.5 | Apr 25, 2026 | Added actual implementation details | Engineering |
| 1.0 | Apr 29, 2026 | Complete reality-based PRD | Architecture Team |

---

**This document represents the actual implementation as of April 29, 2026. Any discrepancies with current codebase should be reported to the engineering team.**

**Last Verified:** April 29, 2026 by: Code Review Team

---

END OF DOCUMENT
