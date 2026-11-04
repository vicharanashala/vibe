# Tasks

Backend first (groups 1–3), then v3 (groups 4–5), then the production frontend (group 6).
- **Backend tests:** run from `backend/` with `npx vitest run <file>`, and the format check with `bash .github/scripts/check-backend-format.sh origin/main <out-file>`.
- **v3 checks:** run from `v3/` with `npx vitest run --root apps/student` and `npx tsc -b apps/student/tsconfig.app.json apps/student/tsconfig.spec.json`. Capture any new fixture from the real local backend.

## 1. Backend: the setting

- [x] 1.1 Add `isLocked?: boolean | null` to `IModule`, `ISection`, the item ref type, the Module, Section and Item transformers, and `CourseTransferValidators`. Add `resolveContentLock` to `models.ts` (design decision 1), with unit tests for every scenario under "Lock inheritance".
- [x] 1.2 Carry the field through `ItemRepository.readItemsGroup`'s allowlist and both directions of `CourseTransferService`. Extend `CourseTransferService.test.ts`, and add a test that hiding another lesson in the section keeps a lesson's lock. Confirm with a test that `copyCourseVersion` keeps locks, and make it copy them if it doesn't.
- [x] 1.3 Add `updateModuleLock`, `updateSectionLock` and `updateItemLock` to the services, the three `PUT …/lock` endpoints with validators and OpenAPI schemas, and the audit actions (design decision 2).

## 2. Backend: enforcement

- [x] 2.1 Add `ContentLockedError` and `ContentLockService.assertOpenForUser(userId, itemId)` (design decisions 3 and 4), bound in the courses container.
- [x] 2.2 Guard `ItemService.readItem`, `ProgressService.startItem`, `stopItem` and `skipItem` (design decision 5), including the submitted-quiz exception in `stopItem` (design decision 6).
- [x] 2.3 Guard `StudyProgressService.recordStudyView`, `AttemptService.attempt`, `AttemptService.submitFeedBackForm` and `ProjectService.submitProject`, each before anything is written.

## 3. Backend: integration tests

- [x] 3.1 Add `backend/src/modules/courses/tests/ContentLocking.test.ts`, using the authenticated harness of `StudyMode.test.ts`, covering every scenario in `specs/backend/content-locking` not already unit-tested:
  - setting, clearing, 403 for students, 404 for unknown targets, archived version;
  - outline responses for students keep locked content, with its setting;
  - strict and study reads refused with the right source, finished lessons, unlocking, a wrong module id in the URL;
  - start, stop, skip, new attempt (no attempt used), study view, feedback and project refused, with nothing stored;
  - an attempt started before locking still saves, submits and stops;
  - instructor exempt;
  - current lesson and totals unchanged by locking;
  - linear: completing the lesson before a locked one moves the current lesson onto it, the next lesson stays closed, and it continues after unlocking;
  - non-linear: only the locked lesson is refused.
- [ ] 3.2 Run the full backend suite (excluding CI's known-broken files) and the format check, and confirm both pass.

## 4. v3 Studio

- [ ] 4.1 Regenerate the API types against the backend from group 3. Add `features/content-lock` with `resolveContentLock`, `contentLockRefusal` and the level wording, with unit tests, and `useSetContentLock` in `features/admin/queries.ts`. Add `isLocked` to the types in `features/courses/queries.ts`.
- [ ] 4.2 Add the Lock submenu and `LockBadge` to `features/admin/course-content.tsx` (design decision 8). Test locking a module, inherited badges, one lesson open inside a locked module, and a failed save keeping the saved value.

## 5. v3 student app

- [ ] 5.1 Add `ContentLockedLesson` to `features/learn/lesson-page.tsx`, checked before `strictOnTouch`. On `CONTENT_LOCKED` from start or stop, invalidate the lesson query. Capture the refusal fixture from the local backend. Test strict mode, study mode on a phone, the unchanged "finish the earlier lessons first" screen, being locked while watching, and a quiz locked mid-attempt that still submits and shows its result. `useAfterQuizSubmit` refreshes data after a submit, so make sure a refused lesson refetch doesn't replace the result screen.
- [ ] 5.2 Show locks in `features/courses/course-page.tsx`: lesson rows, plus section and module headers (design decision 7). Test a locked lesson, a completed locked lesson, and an open lesson inside a locked module. Run the v3 checks and `NX_DAEMON=false npx nx run-many -t lint typecheck --projects=student,api,proctoring --parallel=1`, and confirm they pass.

## 6. Production frontend

- [ ] 6.1 Add `utils/contentLock.ts` with `resolveContentLock`, `contentLockState` and refusal parsing, with unit tests in `utils/contentLock.test.ts`.
- [ ] 6.2 Add `ContentLockPanel`, the `useUpdate…Lock` hooks, and the panel at each level of `teacher-course-page.tsx`.
- [ ] 6.3 Update `student/course-page.tsx` (`isItemLocked`, the `CONTENT_LOCKED` error branch, and the message with no previous lesson), `CourseDrawer.tsx`, and `PhoneStudyLesson.tsx` (design decision 9). Confirm from the code that the drawer's next-lesson search at `CourseDrawer.tsx:158` behaves sensibly with locked lessons. Compare per-file TypeScript error counts with `main` and confirm the changed files gain none.

## 7. End-to-end check

- [ ] 7.1 Against the local stack (backend :4002, v3 :4310, old frontend :4311, database `vibe_v3_local`, no SMTP configured), with a linear and a non-linear course:
  - lock a module in Studio, leave one lesson open, and check the outline and locked screens in v3 in strict and study mode, including phone size;
  - in the linear course, complete the lesson before a locked one, check the student waits, unlock, and check they continue;
  - lock a quiz during an attempt and submit it;
  - lock a section from the production teacher page, and check the drawer, the locked message and the phone screen there;
  - check an instructor can open everything.

  Confirm messages are actually visible on screen, not only present in the page. Video playback is blocked on this server, so stopping a video mid-watch is checked through the API. Record the results in the PR description.

## Workflow follow-up

- Deploy the backend first, then `deploy-frontend-v3` and `deploy-frontend`.
- Archive this change after its PR merges and deploys.
- Decide separately on the two gaps in design (Non-Goals): hidden lessons opening by direct link, and the study-mode check trusting URL ids.
