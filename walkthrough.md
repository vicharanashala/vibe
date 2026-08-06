# Rubric-Based Project Assessment — Walkthrough

## What Was Built

A fully additive rubric-based assessment system layered on top of the existing Project Showcase / Curated Gallery feature. Nothing in the existing gallery, submission model, or auth system was replaced.

---

## Backend Changes

### New Collections
- `project_rubrics` — rubric documents (courseId + versionId scoped)
- `project_assessments` — one assessment per submission (upsert-guaranteed, no duplicates)

### New Files (14)

| File | Purpose |
|------|---------|
| [model.ts](file:///l:/PROJECT/vicharanshala/vibe/backend/src/modules/projects/repositories/model.ts) | Added `ICriterion`, `IRubric`, `IAssessmentCriterionScore`, `IAssessment` interfaces |
| [IRubricRepository.ts](file:///l:/PROJECT/vicharanshala/vibe/backend/src/modules/projects/interfaces/IRubricRepository.ts) | Repo contract: create, getById, getByCourseVersion, update |
| [IAssessmentRepository.ts](file:///l:/PROJECT/vicharanshala/vibe/backend/src/modules/projects/interfaces/IAssessmentRepository.ts) | Repo contract: getBySubmissionId, upsert, countByRubricId |
| [rubricRepository.ts](file:///l:/PROJECT/vicharanshala/vibe/backend/src/modules/projects/repositories/providers/mogodb/rubricRepository.ts) | Native Mongo driver, `@injectable()`, `init()`, `ObjectId.isValid()` guards |
| [assessmentRepository.ts](file:///l:/PROJECT/vicharanshala/vibe/backend/src/modules/projects/repositories/providers/mogodb/assessmentRepository.ts) | `findOneAndUpdate` with `upsert:true`; `$setOnInsert` preserves original `assessedAt` |
| [rubricService.ts](file:///l:/PROJECT/vicharanshala/vibe/backend/src/modules/projects/services/rubricService.ts) | Criterion IDs server-generated; `updateRubric` does lock-check first |
| [assessmentService.ts](file:///l:/PROJECT/vicharanshala/vibe/backend/src/modules/projects/services/assessmentService.ts) | All score computation server-side; validates criterionIds, bounds, negatives |
| [RubricValidators.ts](file:///l:/PROJECT/vicharanshala/vibe/backend/src/modules/projects/classes/validators/RubricValidators.ts) | `CreateCriterionDto` has no `id` field; `UpdateCriterionDto` requires `id`; `@Min(0)` on points |
| [projectAbilites.ts](file:///l:/PROJECT/vicharanshala/vibe/backend/src/modules/projects/abilities/projectAbilites.ts) | 5 new CASL actions: `CreateRubric`, `ManageRubric`, `ViewRubric`, `Assess`, `ViewAssessment` |
| [rubricController.ts](file:///l:/PROJECT/vicharanshala/vibe/backend/src/modules/projects/controllers/rubricController.ts) | 4 routes under `/project/rubric/...` — always derives auth from stored document |
| [assessmentController.ts](file:///l:/PROJECT/vicharanshala/vibe/backend/src/modules/projects/controllers/assessmentController.ts) | `PUT` upsert + `GET` assessment + `GET /submission/my` |
| [types.ts](file:///l:/PROJECT/vicharanshala/vibe/backend/src/modules/projects/types.ts) | 6 new DI symbols |
| [container.ts](file:///l:/PROJECT/vicharanshala/vibe/backend/src/modules/projects/container.ts) | Binds all new repos/services/controllers |
| [index.ts](file:///l:/PROJECT/vicharanshala/vibe/backend/src/modules/projects/index.ts) | Registers `RubricController`, `AssessmentController`, `RUBRIC_VALIDATORS` |
| [RubricController.test.ts](file:///l:/PROJECT/vicharanshala/vibe/backend/src/modules/projects/tests/RubricController.test.ts) | 16 integration tests (TC-01 through TC-15 + TC-12b) |

### Modified Files (4)

| File | Change |
|------|--------|
| [IProjectSubmissionRepository.ts](file:///l:/PROJECT/vicharanshala/vibe/backend/src/modules/projects/interfaces/IProjectSubmissionRepository.ts) | Added `getSubmissionByUserAndProject` (projectId-scoped, bug-safe) |
| [projectSubmissionRepository.ts](file:///l:/PROJECT/vicharanshala/vibe/backend/src/modules/projects/repositories/providers/mogodb/projectSubmissionRepository.ts) | Implemented `getSubmissionByUserAndProject` with all 5 filters including `projectId`; `getByUser()` untouched |
| [projectService.ts](file:///l:/PROJECT/vicharanshala/vibe/backend/src/modules/projects/services/projectService.ts) | Added `getSubmissionByUserAndProject` passthrough |
| [abilities/projectAbilites.ts](file:///l:/PROJECT/vicharanshala/vibe/backend/src/modules/projects/abilities/projectAbilites.ts) | Added 5 new enum values + grants in STUDENT/INSTRUCTOR cases |

---

## Key Invariants Enforced

### Criterion IDs — server-generated only
`CreateCriterionDto` has no `id` field. `RubricService.createRubric()` generates each criterion's ID with `new ObjectId().toString()`. The client cannot supply criterion IDs at creation time. `AssessmentService.saveAssessment()` validates incoming `criterionId` values against the stored rubric's IDs, making the validation tamper-proof.

### Rubric locking — not versioning
`PATCH /project/rubric/:rubricId` calls `assessmentRepository.countByRubricId()` inside a transaction. If count ≥ 1, throws `BadRequestError('Rubric cannot be edited after it has been assessed against.')`. No versioning system built.

### Score calculation — backend-authoritative
`AssessmentService.saveAssessment()` ignores any `totalPoints`/`percentage` from the client. It computes:
- `totalPoints` = sum of awarded points
- `maxPoints` = sum of rubric criteria `maxPoints` at assessment time
- `percentage` = `round((totalPoints / maxPoints) * 10000) / 100`

### Featured field — never touched by assessment
`PUT /project/assessment/submission/:submissionId` calls `assessmentRepository.upsert()` which only writes to `project_assessments`. It never reads or writes `project_submissions.featured`.

### Bug-safe student submission lookup
`GET /project/submission/my` uses `getSubmissionByUserAndProject(userId, projectId, courseId, versionId, cohortId?)` — all five filters applied. `getByUser()` (which omits `projectId`) is not used here and is not modified.

### Authorization pattern — mirrors setFeatured exactly
Both `PUT /assessment/...` and `PATCH /rubric/:rubricId` and `GET /rubric/:rubricId` load the resource from the database first, derive `courseId`/`versionId` from the stored document, then check the CASL ability. Caller-supplied course IDs are never trusted for auth.

---

## Routes Added

| Method | Path | Action | Who |
|--------|------|--------|-----|
| `POST` | `/project/rubric/course/:courseId/version/:versionId` | `CreateRubric` | INSTRUCTOR |
| `GET` | `/project/rubric/course/:courseId/version/:versionId` | `ViewRubric` | INSTRUCTOR, STUDENT |
| `GET` | `/project/rubric/:rubricId` | `ViewRubric` | INSTRUCTOR, STUDENT |
| `PATCH` | `/project/rubric/:rubricId` | `ManageRubric` (locked once assessed) | INSTRUCTOR |
| `PUT` | `/project/assessment/submission/:submissionId` | `Assess` | INSTRUCTOR only |
| `GET` | `/project/assessment/submission/:submissionId` | `ViewAssessment` | INSTRUCTOR (any in course), STUDENT (own only) |
| `GET` | `/project/submission/my` | `ViewAssessment` | STUDENT (own), INSTRUCTOR |

---

## Frontend Changes

### New hooks in [hooks.ts](file:///l:/PROJECT/vicharanshala/vibe/frontend/src/hooks/hooks.ts) (7 hooks)

| Hook | Method | Endpoint |
|------|--------|----------|
| `useRubric` | GET | `/project/rubric/:rubricId` |
| `useRubricsByCourseVersion` | GET | `/project/rubric/course/:courseId/version/:versionId` |
| `useCreateRubric` | POST mutation | `/project/rubric/course/:courseId/version/:versionId` |
| `useUpdateRubric` | PATCH mutation | `/project/rubric/:rubricId` |
| `useSubmissionAssessment` | GET | `/project/assessment/submission/:submissionId` |
| `useSaveAssessment` | PUT mutation | `/project/assessment/submission/:submissionId` |
| `useMySubmission` | GET | `/project/submission/my` |

All follow the `useProjectGallery`/`useSetFeaturedSubmission` pattern: manual `fetch`, `Authorization: Bearer`, TanStack Query, `queryClient.invalidateQueries` + `sonner` toast on mutation.

### New teacher page: [RubricBuilderPage.tsx](file:///l:/PROJECT/vicharanshala/vibe/frontend/src/app/pages/teacher/RubricBuilderPage.tsx)

- Route: `/teacher/courses/rubric-builder?courseId=...&versionId=...`
- Create form with dynamic criteria rows (no `id` field — IDs come from server)
- Existing rubrics listed with expand/collapse, edit mode, lock detection (400 response → locked badge)

### Extended: [CurateGalleryPage.tsx](file:///l:/PROJECT/vicharanshala/vibe/frontend/src/app/pages/teacher/CurateGalleryPage.tsx)

- Added "Assess" button column — **separate column from "Showcase" (star)**
- Clicking "Assess" opens an inline `AssessPanel` below that row (only one open at a time)
- `AssessPanel` has: rubric dropdown, per-criterion point inputs + feedback inputs, score summary, overall feedback, save button
- If no rubrics exist → shows redirect hint to Rubric Builder (non-blocking per spec)
- Star "Showcase" toggle is unchanged and operates independently

### Extended: [StudentProjectItem.tsx](file:///l:/PROJECT/vicharanshala/vibe/frontend/src/app/pages/student/components/StudentProjectItem.tsx)

- Added `useMySubmission` hook call (projectId-scoped)
- "My Assessment" section appears below gallery if assessment exists
- Shows: total score, per-criterion points + feedback, overall feedback, assessed date
- No edit affordance, ever

---

## Verification

### Run new backend tests
```powershell
# From backend/:
npx vitest run src/modules/projects/tests/RubricController.test.ts
```

### Run full project test suite (regression check)
```powershell
npx vitest run src/modules/projects/tests/
```

### TypeScript compile — both pass clean
```powershell
# Backend:
cd backend && npx tsc --noEmit   # exit 0 ✓
# Frontend:
cd frontend && npx tsc --noEmit  # exit 0 ✓
```
