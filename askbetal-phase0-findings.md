# Ask Betal — Phase 0: Inspection Findings Report

This report documents the architectural and technical findings gathered during the read-only investigation of the ViBe codebase to assess the feasibility of the proposed "Ask Betal" AI teaching assistant.

---

## 1. GenAI Module Audit

### Findings
* **Module Structure**: The `genAI` module is located at [backend/src/modules/genAI/](file:///C:/Projects/vibe/backend/src/modules/genAI/). It contains standard scaffolded elements: `GenAIController`, `GenAIService`, `GenAIRepository`, type definitions, and abilities.
* **Core Functionality**: The module coordinates asynchronous media processing and quiz generation jobs (e.g., transcription generation, video segmentation, and MCQ generation).
* **LLM Calls**: The `genAI` module itself does not instantiate or directly call an LLM SDK. Instead, LLM interaction happens in the `quizzes` module inside [QuestionService.ts](file:///C:/Projects/vibe/backend/src/modules/quizzes/services/QuestionService.ts#L420-L439), which imports and instantiates `@anthropic-ai/sdk`.
* **Reusability**: No generic, reusable AI client is currently exported by the `genAI` module for general prompt/context injection. The LLM logic in `QuestionService` is tightly coupled to MCQ generation prompts.
* **Streaming Support**: No LLM response streaming is implemented. However, the `genAI` module includes a simple, memory-based Server-Sent Events (SSE) server at [sseService.ts](file:///C:/Projects/vibe/backend/src/modules/genAI/services/sseService.ts) to push job state updates to client EventSource listeners using a `jobId`.

---

## 2. AI Config Audit

### Findings
* **File Location**: [backend/src/config/ai.ts](file:///C:/Projects/vibe/backend/src/config/ai.ts)
* **Configuration Parameters**:
  - `serverIP` (loads `AI_SERVER_IP` or defaults to `'localhost'`)
  - `serverPort` (loads `AI_SERVER_PORT` or defaults to `9017`)
  - `proxyAddress` (loads `AI_PROXY_ADDRESS` or defaults to `'socks5h://localhost:1055'`)
  - `ANTHROPIC_CRED` (loads `ANTHROPIC_CRED` API key or defaults to `null`)
  - `ANTHROPIC_MODEL` (loads `ANTHROPIC_MODEL` model identifier or defaults to `null`)
* **Error & Client Handling**:
  - Instantiation handles basic key presence checks.
  - No advanced timeout, retry, or rate-limiting decorators/wrappers exist in the config or the Anthropic client initialization code.

---

## 3. Content Schema Audit

### Findings
* **Transcript Field**: **No** transcript field exists on the video document (`VideoItem` class inside [Item.ts](file:///C:/Projects/vibe/backend/src/modules/courses/classes/transformers/Item.ts#L67-L95)) or the `IVideoDetails` interface in [models.ts](file:///C:/Projects/vibe/backend/src/shared/interfaces/models.ts#L329-L334). While transcripts are transiently processed during LLM job flows, they are not saved in the videos collection metadata.
* **Slides**: Slides are not stored as text-extractable content; no slide-text schema exists in the repository.
* **Notes**: No "notes" or "reference document" entity is attached to video or section schemas today.

---

## 4. Quiz Explanation Audit

### Findings
* **Explanation Schema**: The `explaination` (string) field exists inside the `ILotItem` interface (defined in [quiz.ts](file:///C:/Projects/vibe/backend/src/shared/interfaces/quiz.ts#L57-L61)) representing options for multiple-choice questions.
* **Visibility**: Surfaced to students after submission (configured by the quiz's `details.showExplanationAfterSubmission` boolean setting).
* **Security & Surfacing**: Because correct option details (`correctLotItem`) include the correct answer text and the explanation, this content must **never** be sent to the client pre-attempt or leaked to a general Q&A assistant before a student completes the quiz.

---

## 5. Database Deployment Audit

### Findings
* **File References**: [backend/.env](file:///C:/Projects/vibe/backend/.env) (Line 11), [MongoDatabase.ts](file:///C:/Projects/vibe/backend/src/shared/database/providers/mongo/MongoDatabase.ts).
* **Configuration**: The connection string is configured as `DB_URL=mongodb://localhost:27017` with `DB_TLS=false` and `DB_NAME=vibe`.
* **Deployment Target**: Plain self-hosted MongoDB running locally (via Docker). This indicates that MongoDB Atlas-specific vector indexing features are **not** supported locally without architectural/provider changes.

---

## 6. Background Job / Queue Audit

### Findings
* **Dependencies**: No Redis or BullMQ/Bull dependencies are installed in [package.json](file:///C:/Projects/vibe/backend/package.json).
* **Scheduling**: The project includes `node-cron` for standard cron job triggering and `express-rate-limit` for rate limiting. 
* **Worker Execution**: Background tasks are handled via lightweight worker scripts under `src/workers/` executed via parent process clusters/forks rather than centralized queue queues.

---

## 7. Auth/Enrollment Pattern Audit

### Findings
* **Authentication**: Enforced at the controller level using the routing-controllers `@Authorized()` decorator.
* **Access Control**: Checked using CASL MongoAbility via the custom `@Ability(getProgressAbility)` parameter decorator (defined in [progressAbilities.ts](file:///C:/Projects/vibe/backend/src/modules/users/abilities/progressAbilities.ts)). For students, it validates enrollment role access bounds:
  ```typescript
  can(ProgressActions.View, 'Progress', { userId: user.userId, courseId: enrollment.courseId, versionId: enrollment.versionId });
  ```

---

## 8. Frontend Content-Viewing Surface Audit

### Findings
* **Client Tech Stack**: React (v19) built via Vite, using TailwindCSS, Radix UI, Shadcn UI, and Material UI components.
* **State Management**: Client-side state is handled using **Zustand** (`zustand`) and server state synchronization uses **React Query** (`@tanstack/react-query`).
* **API Invocations**: Structured via `openapi-fetch` and `@tanstack/react-query` to provide type-safe schema bindings matching the backend endpoints.
