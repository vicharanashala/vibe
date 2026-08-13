# Concept Map Navigator — Implementation Plan (4 weeks, file by file)

Executes the decisions in [design-decisions.md](./design-decisions.md). Ordered by dependency;
each week leaves the repo working and shippable. Terms per [glossary.md](./glossary.md).

**Architecture in one line:** `CONCEPT_MAP` becomes a backend-executed pipeline task (same
execution model as `UPLOAD_CONTENT`, which never touches the AI server), inserted after
`SEGMENTATION`; the generated map is previewed/approved by the teacher via the existing task flow,
anchor-resolved to real video items during `UPLOAD_CONTENT`, persisted to a new `conceptmaps`
collection, and read by students through an enrollment-guarded route into a shared
`ConceptMapPanel` React Flow component. Week 3 layers a quiz-linked mastery overlay and adoption
features on top; week 4 is evaluation and hardening.

---

## Zero-impact guarantees (non-negotiable, enforced throughout)

The feature must leave the existing platform byte-for-byte equivalent in behavior when unused:

1. **No existing schema is modified.** The published map lives in its own `conceptmaps`
   collection; course/item/quiz documents are untouched.
2. **Legacy jobs are immune.** Any job document without `jobStatus.conceptMap` (everything created
   before this change) skips the task entirely — the continue-chain, state cascade, and upload
   gating all treat `undefined` as "not part of this job".
3. **Kill switch.** Env flag `CONCEPT_MAP_ENABLED` (default `true`). When `false`: new jobs are
   created without the `conceptMap` status field (they follow the legacy path exactly), and the
   student route returns an empty list. One flag flip restores pre-feature behavior platform-wide.
4. **Absence is silent.** No map generated / task failed / flag off → `UPLOAD_CONTENT` proceeds
   unchanged, the student course page renders exactly as today (the panel only mounts when a map
   exists for the section).
5. **No existing route, controller, or ability is altered** — only new ones added, plus additive
   fields on GenAI job internals.
6. **Frontend bundle isolation.** `@xyflow/react` + dagre are lazy-loaded (`React.lazy`/dynamic
   import) inside the panel, so students who never open a map download nothing new.

## Cost discipline (the feature must be cheap to run)

1. **At most one LLM call per lecture, ever** (plus explicit teacher-triggered regenerations).
   Generated once at pipeline time, persisted, served from Mongo forever. **The student path never
   touches an LLM.**
2. **Small model, small tokens.** Model comes from the existing `ANTHROPIC_MODEL` env (a Haiku-class
   model is sufficient — input is a 15–45-min lecture transcript ≈ 4–8k tokens; output is capped
   ~25 nodes of structured JSON ≈ 1–2k tokens). Order of magnitude: well under $0.05 per lecture on
   a Haiku-class model; a 275-video course (≈40 lectures) maps for roughly the price of a coffee.
3. **Zero cost with no key.** The deterministic fallback keeps every environment functional at $0.
4. **No new infrastructure.** No queues, no cron, no websockets beyond the existing SSE; map
   payloads are <10 KB JSON documents; one indexed Mongo query per section view.
5. **Retry budget.** Invalid LLM output gets exactly one corrective retry, then FAILED — no
   unbounded retry loops.

---

## Week 1 — Backend core

### 1. `backend/src/modules/genAI/classes/transformers/GenAI.ts` (modify)
- `TaskType`: add `CONCEPT_MAP = 'CONCEPT_MAP'`.
- `JobStatus`: add `conceptMap: TaskStatus` field, set to `TaskStatus.PENDING` in the constructor
  **only when `CONCEPT_MAP_ENABLED`** (else omitted → legacy path).
- New `ConceptMapParameters` interface (`maxConcepts?`, `promptHint?`) + optional
  `conceptMapParameters?` on `GenAI`.
- New `conceptMapData` interface: `{ status, error?, nodes, edges, modelUsed?, fallback?: boolean }`
  where nodes carry `{ id, label, description, segmentEnd }` (segment anchor = the segment's
  end-boundary value, same convention as `questions[].segmentId`) and edges `{ from, to }`.
- `TaskData`: add `conceptMap?: conceptMapData[]`.

### 2. `backend/src/modules/genAI/classes/transformers/ConceptMap.ts` (new)
Published-map document classes: `ConceptMapNode` (`id, label, description, segmentEnd,
videoItemId, offsetSeconds`), `ConceptMapEdge` (`from, to`), `ConceptMap` (`_id?, jobId, courseId,
versionId, moduleId, sectionId, nodes, edges, createdAt`). This is the student-facing shape;
`videoItemId`/`offsetSeconds` exist only here (resolved at upload), not in the in-pipeline
`conceptMapData`.

### 3. `backend/src/modules/genAI/classes/validators/GenAIValidators.ts` (modify)
- `JobBody`: optional `conceptMapParameters` (repo gotcha: must carry `@IsOptional()` or it is
  rejected when missing).
- `WebhookBody.task` / `TaskStatusParams`: accept `CONCEPT_MAP`.
- New response classes for OpenAPI: `ConceptMapNodeResponse`, `ConceptMapEdgeResponse`,
  `ConceptMapResponse` (these drive the generated frontend types).

### 4. `backend/src/modules/genAI/services/ConceptMapService.ts` (new — the core)
`generateForJob(jobId, transcriptChunks, segmentMap, parameters)`:
- **LLM path** (when `aiConfig.ANTHROPIC_CRED` is set — copy the guarded pattern from
  `QuestionService.ts:413`): one `anthropic.messages.create` call; prompt demands strict JSON:
  concepts each anchored to a transcript-chunk index, prerequisite edges by concept id, no prose.
- **Fallback path** (no key): deterministic map — one concept per segment labeled from the chunk's
  leading words, plus sequential edges and one or two skip-links, so every environment renders a
  plausible DAG at $0.
- **Validation (both paths, before storing):** every anchor references a real segment; edge
  endpoints exist; graph is acyclic (topological-sort check); ~25-node cap. Invalid LLM output →
  one retry with validator errors appended, then `FAILED` with a readable `error`.
- Reports lifecycle like the pipeline expects: sets `RUNNING`, then calls
  `genAIService.updateJob(jobId, TaskType.CONCEPT_MAP, data)` with `COMPLETED`/`FAILED` and sends
  SSE via `SseService` (mirroring `WebhookController.handleWebhook`), so existing teacher-UI
  polling/SSE just works.

### 5. `backend/src/modules/genAI/services/GenAIService.ts` (modify — six touch points)
- **`getJobState` cascade** (~line 854): insert a `CONCEPT_MAP` block between SEGMENTATION and
  QUESTION_GENERATION — when `jobStatus.conceptMap` is present and not PENDING/RUNNING, current
  task = CONCEPT_MAP, `file` = segmentation's `transcriptFileUrl`, `segmentMap` = segmentation's map.
- **`approveTaskContinue`** (~line 369): rewire the chain — `segmentation COMPLETED → conceptMap =
  WAITING` (when the field exists); new branch `conceptMap COMPLETED → questionGeneration = WAITING`.
- **`approveTaskToStart` / `rerunTask`**: branch `if (jobState.currentTask === TaskType.CONCEPT_MAP)`
  → call `conceptMapService.generateForJob(...)` (backend-executed, exactly like the existing
  UPLOAD_CONTENT branch at lines 269/336) instead of `webhookService.approveTaskStart`.
- **`updateJob`** (~line 717): new `case TaskType.CONCEPT_MAP` storing into
  `taskData.conceptMap[]` and `job.jobStatus.conceptMap`.
- **`getTaskStatus`** (~line 472): new switch case returning `taskData.conceptMap`.
- **`uploadContent`** (~line 931): after `createdVideoItemsInfo` is built, take the latest
  COMPLETED `taskData.conceptMap` entry, resolve each node's `segmentEnd` → the created item for
  that segment (`videoItemId`, `offsetSeconds` = anchor − segment start), and
  `conceptMapRepository.upsertForJob(...)` inside the same transaction. No map → skip silently.
- **Upload gating** (~line 886): the UPLOAD_CONTENT cascade condition adds `conceptMap` COMPLETED
  **or absent** to the conjunction.
- **Legacy rule everywhere:** `jobStatus.conceptMap === undefined` ⇒ task not part of this job.

### 6. `backend/src/modules/genAI/repositories/providers/mongodb/ConceptMapRepository.ts` (new)
Follow `GenAIRepository`'s collection/session pattern: `upsertForJob(map, session)`,
`getBySection(versionId, sectionId, session)`, `getByJob(jobId, session)`. Collection
`conceptmaps`, index on `(versionId, sectionId)`.

### 7. `backend/src/modules/genAI/controllers/ConceptMapController.ts` (new)
- `GET /concept-maps/section/:versionId/:sectionId` — student read of published maps for a section.
  `@Authorized()` + enrollment-scoped ability. Returns `ConceptMapResponse[]`.
- `GET /concept-maps/job/:jobId/preview` — teacher-only: latest in-pipeline `conceptMapData` for
  the approval preview (reads `taskData`, works before publish).

### 8. `backend/src/modules/genAI/abilities/genAIAbilities.ts` (modify)
Add a `ConceptMap` subject: `view` for enrolled students of the course version, `preview` for the
job owner/teacher. Export via `abilities/index.ts`.

### 9. `backend/src/modules/genAI/types.ts` + `container.ts` + `index.ts` (modify)
DI symbols (`ConceptMapService`, `ConceptMapRepo`), bindings, controller + validator exports per
the module auto-discovery contract.

### 10. `backend/src/modules/genAI/services/WebhookService.ts` (no changes)
No AI-server support needed — CONCEPT_MAP is executed inside the backend itself (like
UPLOAD_CONTENT), so it never reaches the webhook/AI-server path.

### 11. Contract sync
Run `pnpm copy` then `pnpm gen-schema` in `frontend/` so the typed client knows the new
routes/shapes. Commit regenerated files with the backend commit that added the routes.

## Week 2 — Frontend core + verify

### 12. `frontend/package.json` (modify)
Add `@xyflow/react` (React Flow v12) and `@dagrejs/dagre`. Both consumed only inside the
lazy-loaded panel (see zero-impact #6).

### 13. `frontend/src/components/concept-map/ConceptMapPanel.tsx` (new, + `layout.ts`, `ConceptNode.tsx`)
The one shared surface (ADR-005). Props: `nodes`, `edges`, `highlightNodeId?`,
`nodeState?(node) → 'locked' | 'available' | 'current' | 'mastered' | 'weak'`,
`onNodeClick?(node)`, `readOnly?`. `layout.ts` runs dagre top-down and returns positioned React
Flow nodes (deterministic — no force simulation). `ConceptNode` renders label + state styling;
description on hover/tap. Light/dark aware. Exported behind `React.lazy`.

### 14. Teacher pipeline UI (modify — the workflow that enumerates tasks)
`AiWorkflow.tsx` hardcodes `STEP_ORDER` (line 99) and task→jobStatus key mappings (lines 332, 608);
the same enumeration appears in `AdvancedAiWorkflow.tsx`, `SmartBloomWorkflow.tsx`, `AiModule.tsx`,
`task-accordion.tsx`, `run-question-section.tsx`, `AISectionPage.tsx`, `AISectionModal.tsx`.
Identify which workflow the current teacher flow actually mounts, update it fully (insert
`CONCEPT_MAP` after `SEGMENTATION` in step order + status maps + accordion entry rendering
`ConceptMapPanel` at `WAITING` with the existing Approve/Start, Rerun, Continue buttons), then
patch the sibling enumerations mechanically.

### 15. `frontend/src/lib/genai-api.ts` (modify)
Add `getConceptMapPreview(jobId)` and the `ConceptMap` TS types the panel consumes. Existing
`approveStartTask`/`approveContinueTask`/`rerunJobTask` already cover the lifecycle.

### 16. `frontend/src/app/pages/student/course-page.tsx` (modify — additive only)
- Fetch published maps for the selected section via the typed client, enabled when a section is
  selected; panel mounts only when maps exist.
- Collapsible "Concept Map" panel on the section view.
- `nodeState`: `locked` when the node's `videoItemId` is ahead of progress under
  `linearProgressionEnabled` (same data that drives item locking); `current` when
  `videoItemId === selectedItemId` (line 241's state).
- `onNodeClick` (unlocked): `setSelectedItemId(node.videoItemId)` — the page's existing navigation
  mechanism. No player-internal changes in week 2.

### 17. Tests + end-to-end verify
- `backend/src/modules/genAI/tests/ConceptMapService.test.ts` (new): fallback determinism, anchor
  validation, cycle rejection, node cap, no-key path never throws.
- `backend/src/modules/genAI/tests/GenAITaskFlow.test.ts` (new): continue-chain order including
  CONCEPT_MAP; legacy job (no field) skips and still reaches UPLOAD_CONTENT; flag-off path.
- Full local verify: teacher pipeline → map WAITING → preview → approve → publish → student sees
  map → locked/unlocked → click navigates. Repeat once with `ANTHROPIC_CRED` if available.

## Week 3 — Enrichment (each item independently shippable)

### 18. Mastery overlay — quiz-linked node states (the week's centerpiece)
Concepts anchor to segments; segments already have quizzes. Join them so the map shows the
student's own understanding: `mastered` (segment quiz passed), `weak` (attempted, not passed —
"revisit this"), neutral otherwise.
- Backend: extend the student concept-map response (or a sibling
  `GET /concept-maps/section/:versionId/:sectionId/progress` endpoint) with per-node quiz outcome
  derived from existing quiz-attempt data — read-only join, no new writes, no schema changes.
- Frontend: feed `nodeState` in `course-page.tsx` from that data; legend row in the panel.
- This is the feature's strongest answer to "which concepts should I revisit when confused."

### 19. Within-item offset seek (promoted from stretch)
Thread `initialSeekSeconds` through `frontend/src/components/Item-container.tsx` →
`frontend/src/components/video.tsx`, applied only when the existing seek rules allow (backward
always; forward only with `seekForwardEnabled`). Node click on a long item lands at the concept,
not just the item.

### 20. Teacher node deletion at approval (promoted from deferred)
One scoped mutation: at the WAITING preview, teacher can remove a node (incident edges drop;
orphaned "islands" are re-linked to the nearest ancestor or left standalone). New
`PATCH /genai/:jobId/concept-map/preview` (teacher ability) editing the latest `conceptMapData`
entry; panel gets a delete affordance in teacher mode only. One bad node no longer forces full
regeneration.

### 21. Retroactive generation for existing courses (promoted from open item)
For completed jobs (e.g. the live MERN course's lectures): teacher triggers CONCEPT_MAP on a
finished job via the existing rerun machinery — `rerunTask` already accepts completed tasks; add
the path where a legacy job *gains* `jobStatus.conceptMap` when the teacher explicitly requests
generation (`POST /genai/:jobId/concept-map/generate`, teacher ability). Anchor resolution reads
the job's already-created items from `taskData.uploadContent`/`createdVideoItemsInfo` history.
This is the adoption story: existing content gets maps without re-running pipelines.

## Week 4 — Evaluation, instrumentation, hardening

### 22. Usage telemetry (tiny, additive)
Frontend events: map opened, node clicked (with locked/unlocked + state), time from map-open to
item-navigation. Emit through whatever analytics path the app already uses; if none fits, a
minimal `POST /concept-maps/telemetry` append-only collection (no PII beyond userId, no reads in
hot paths). Feeds the evaluation below and any future real user study.

### 23. Simulated navigation-efficiency evaluation (honest framing — see note)
`e2e/` Playwright harness, new spec `concept-map-eval.spec.ts`: for N seeded lectures ×
M target concepts, measure scripted task completion — "locate where concept X is taught" — under
(a) timeline/segment-list navigation vs (b) map-click navigation. Metrics: interaction count,
elapsed time, wrong-segment visits. Deterministic seeds, results dumped as JSON/CSV for the
write-up. **This measures the system's navigation mechanics, not human learning — it must be
reported as a simulation, never as a user study.** H2/H3 (learning, confidence) are explicitly
"future work pending a human study" in the write-up; if 2–3 peers become available informally,
their runs are a labeled bonus pilot, not the headline.

### 24. Generation-quality benchmark
Hand-build gold-standard maps for 2–3 real lecture transcripts (`docs/.../gold-maps/*.json`).
Script (backend `scripts/eval-concept-maps.mjs`) scores LLM output vs gold: node recall/precision
(label similarity), edge agreement, DAG validity rate across k regenerations. Gives the write-up a
generation-quality number, not just screenshots.

### 25. LLM quality pass (only if benchmark shows need)
Cheap self-consistency: second "critique & merge" call on the first draft (still ≤2 calls per
lecture, within cost budget); concept descriptions polished to double as hover-definitions
(absorbing the flat-glossary use case).

### 26. Hardening + write-up
- E2E happy-path spec for the teacher flow.
- Accessibility pass on the panel (keyboard focus order, aria labels on nodes).
- Re-verify all zero-impact guarantees: legacy job, flag off, no-map section, no-key environment.
- Final write-up: architecture, cost analysis (per-lecture price), simulation + benchmark results,
  honest limitations, future work (human study, section-level merge).

---

## Commit / PR mapping

All feature commits on `feature/concept-map-navigator` (PR-bound — unlike the local-setup commits,
per the branch plan). Slices: (1) task machinery backend, (2) ConceptMapService + repo + routes +
abilities, (3) schema regen, (4) shared panel + teacher UI, (5) student integration, (6) tests,
(7) mastery overlay, (8) offset seek, (9) node deletion, (10) retroactive generation,
(11) telemetry + eval harness + benchmark, (12) docs/write-up. Weeks 1–2 (slices 1–6) form a
complete, mergeable core — if anything slips, the PR can cut at any slice boundary ≥6.

## Known risks going in

- **Task-order enumeration sprawl** — order lives in ≥5 backend spots and ≥8 frontend files; the
  grep list in §14 is the checklist; the task-flow test guards the backend chain.
- **Legacy jobs** — the `undefined → skip` rule must hold at *every* backend touch point, or old
  in-flight jobs brick at segmentation. Covered by dedicated test + week-4 re-verify.
- **LLM output validity** — strict JSON + validation + one retry; FAILED with readable error is an
  acceptable outcome (teacher reruns).
- **course-page.tsx size** — 2.5k-line component; keep integration additive (one fetch, one panel,
  two callbacks); no refactoring in this PR.
- **Evaluation integrity** — simulation results must never be presented as human-subject data;
  framing is fixed in §23 and the write-up template.
