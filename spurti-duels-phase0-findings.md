# Spurti Duels — Phase 0: Inspection Findings Report

This report documents the architectural and technical findings gathered during the read-only investigation of the ViBe codebase to assess the feasibility of the proposed "Spurti Duels" peer-challenge system.

---

## 1. Spurti Points / HP System Audit

### Findings
* **Points Balance Storage**: The active point balance (HP) for a student is stored inside the **`enrollment`** collection document under the **`hpPoints`** field (`hpPoints?: number;`), as shown in [models.ts](file:///C:/Projects/vibe/backend/src/shared/interfaces/models.ts#L423).
* **Initial Crediting**: Points are initialized upon course enrollment within [EnrollmentService.ts](file:///C:/Projects/vibe/backend/src/modules/users/services/EnrollmentService.ts#L190-L248).
* **Ledger Entries**: Points updates are audited by creating records in the `hp_ledger` collection (represented by the `HpLedgerTransformer` schema in [Ledger.ts](file:///C:/Projects/vibe/backend/src/modules/hpSystem/classes/transformers/Ledger.ts)).
* **Cross-Module Boundaries**: The `hpSystem` module manages activity rewards (like assignment grading/approvals) via [activitySubmissionsService.ts](file:///C:/Projects/vibe/backend/src/modules/hpSystem/services/activitySubmissionsService.ts) which fetches enrollment details and writes to the ledger. This establishes a clean pattern of calling `LedgerRepository` or service methods rather than directly updating MongoDB collections.

---

## 2. Quiz Module Audit

### Findings
* **Question Schema**: Described in [quiz.ts](file:///C:/Projects/vibe/backend/src/shared/interfaces/quiz.ts). Contains question metadata and options.
* **Grading Method**: Evaluated using the `QuestionProcessor` class inside [QuestionProcessor.ts](file:///C:/Projects/vibe/backend/src/modules/quizzes/question-processing/QuestionProcessor.ts). The processor creates a specific grader (e.g. `SOLQuestionGrader`) and executes `.grade(answer, quiz, parameterMap, selectedAnswerTexts)`.
* **Repository Queries**: Questions can be queried and retrieved by ID from the `questions` collection. The `QuestionRepository` contains standard CRUD and query operations.
* **Anti-Cheat Boundaries**: In the default quiz view, answers and hints are removed before transmission to client endpoints to prevent local inspection.
* **Attempt Modeling**: The existing quiz attempt system (`quiz_attempts`, `user_quiz_metrics`) assumes a single-player, self-paced, untimed or simple deadline-based flow. It does not support multiplayer sync states, meaning dual-player state transitions must be modeled as a parallel entity that only references the questions.

---

## 3. Real-Time Infrastructure Audit

### Findings
* **WebSocket Plumbing**: **No** WebSocket dependencies (e.g., `socket.io` or `ws`) are present in [package.json](file:///C:/Projects/vibe/backend/package.json).
* **SSE Capabilities**: The `genAI` module implements a lightweight Server-Sent Events service ([sseService.ts](file:///C:/Projects/vibe/backend/src/modules/genAI/services/sseService.ts)), but it is localized for tracking asynchronous background jobs rather than general-purpose bidirectional messaging.
* **REST & Polling**: The application communicates strictly via request/response REST APIs. Long-running tasks use periodic HTTP polling client-side to synchronize local client state.

---

## 4. Enrollment / Course-Access Check Audit

### Findings
* **Access Control Pattern**: Backend controllers use the routing-controllers `@Authorized()` decorator to authenticate request sessions.
* **Enrollment Checking**: Verified using CASL abilities wrapped by the custom `@Ability(getProgressAbility)` parameter decorator. It constructs a subject validation rule:
  ```typescript
  const progressResource = subject('Progress', { userId, courseId, versionId });
  if (!ability.can(ProgressActions.View, progressResource)) {
    throw new ForbiddenError('You do not have permission to view this progress');
  }
  ```
  This CASL-based check enforces course boundaries cleanly and can be reused verbatim for duel endpoints.

---

## 5. Notifications Module Audit

### Findings
* **Module Structure**: Located at [backend/src/modules/notifications/](file:///C:/Projects/vibe/backend/src/modules/notifications/).
* **Core Service**: [NotificationService.ts](file:///C:/Projects/vibe/backend/src/modules/notifications/services/NotificationService.ts) manages database-backed in-app notifications stored in the `notifications` collection.
* **Notification Types**: Supports types like `ejection`, `reinstatement`, `policy_created`, `policy_updated`, and `inactivity_warning`.
* **Custom Messaging**: We can invoke `notificationService.createNotification(notification)` to insert custom duel invites (e.g., type `'challenge'`) dynamically.

---

## 6. Rate Limiting / Abuse-Prevention Audit

### Findings
* **Rate Limiting**: Configured using the `express-rate-limit` package (registered in [package.json](file:///C:/Projects/vibe/backend/package.json)). This can be applied to API routes via middleware to restrict creation frequencies.

---

## 7. Scheduler / Cron / TTL Audit

### Findings
* **Scheduling Engine**: The application lists `node-cron` in dependencies, enabling basic cron jobs.
* **TTL Indexes**: Stale/expired pending duel documents can be automatically cleaned up by setting a TTL index (`expireAfterSeconds`) directly on the `createdAt` or `expiresAt` field in MongoDB, which requires **no additional background running scripts**.

---

## 8. Frontend Real-Time/State-Management Audit

### Findings
* **State Management Library**: Client state is structured using **Zustand** (`zustand`). Server queries and caching are managed via **React Query** (`@tanstack/react-query`).
* **UI Conventions**: Tailored TailwindCSS styling, Radix UI primitives, Shadcn components, and Material UI components.
