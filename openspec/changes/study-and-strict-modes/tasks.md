# Tasks

Three PRs, in order: backend (groups 1–3), then v3 (groups 4–5) and the production frontend (group 6). Backend tests run from `backend/` with `pnpm vitest run <file>`. Production frontend checks run from `frontend/` with `pnpm test && pnpm typecheck`.

## 1. Backend: study-mode setting and inheritance

- [ ] 1.1 Add `studyModeEnabled?: boolean | null` to `IModule`, `ISection` and the item interfaces in `backend/src/shared/interfaces/models.ts`, and to the Module, Section and Item transformers (including their OpenAPI schemas). Verify with `pnpm tsc --noEmit` from `backend/`.
- [ ] 1.2 Add `resolveStudyMode(item, section, module)` next to `resolveProctoringDetectors`, returning `{ allowed, source }` with the `!= null` check. Unit-test every inheritance scenario in `specs/backend/study-mode` (nothing set, module off, item overrides module, section overrides module, `null` from Mongo means inherit) in a new `backend/src/shared/interfaces/tests/resolveStudyMode.test.ts`.
- [ ] 1.3 Make version copy/transfer carry the field: check `CourseVersionService` and `CourseTransferService` item-copy code and add `studyModeEnabled` where items are rebuilt. Verify with a case in `CourseTransferService.test.ts` where a disallowed module, section and item survive the copy.

## 2. Backend: teacher endpoints

- [ ] 2.1 Add `PUT /courses/versions/:versionId/modules/:moduleId/study-mode`, `…/sections/:sectionId/study-mode` and `PUT /courses/versions/:versionId/items/:itemId/study-mode`, taking `{ studyModeEnabled: boolean | null }`. Model them on the proctoring override endpoints (`ModuleController.ts:218`, `ItemController.ts:890`), with the same `CourseVersionActions.Modify` check, validators and repository updates.
- [ ] 2.2 Return each node's own `studyModeEnabled` in the teacher-facing version-structure and item responses. Add integration tests in a new `backend/src/modules/courses/tests/StudyMode.test.ts` (set up like `SelectiveProctoring.test.ts`): instructor sets/clears each level (200), a student gets 403, an unknown id gets 404, and the stored value reads back. Verify with `pnpm vitest run src/modules/courses/tests/StudyMode.test.ts`.

## 3. Backend: study-mode lesson read

- [ ] 3.1 Add `StudyModeError` (an `HttpError` 403 whose `name` is `STUDY_MODE_DISABLED` / `STUDY_MODE_QUIZ`, with `details: { source }`), and pass `details` through in `HttpErrorHandler`'s plain-`HttpError` branch only when present. Test that the new error body carries `name` and `details`, and that an existing `HttpError` body is byte-for-byte unchanged.
- [ ] 3.2 Accept `?mode=study` on the lesson read route (`ItemController.ts:705-737`) and handle it in `ItemService.readItem`:
  - enrollment is checked as now;
  - a quiz is rejected with `STUDY_MODE_QUIZ`;
  - an item with study mode disallowed is rejected with `STUDY_MODE_DISABLED` and its source;
  - otherwise the item is returned, skipping the linear check and the progress-pointer update.

  Every lesson response gains `studyMode: { allowed, source }`.
- [ ] 3.3 Add `StudyMode.test.ts` cases for every read scenario in `specs/backend/study-mode`:
  - reading ahead in a linear course returns the item, and the progress document is unchanged before and after;
  - disallowed and quiz reads return 403 with the right `name`;
  - a non-enrolled read is rejected;
  - a normal read without `mode=study` of an unreached item still gets today's 403.

  Run the full backend suite with `pnpm vitest run` and confirm no regressions. Regenerate the OpenAPI spec (`node scripts/generate-openapi.cjs`) and confirm the new endpoints, query param and response field are in it.

## 4. v3 student app: study and strict modes

- [ ] 4.1 Regenerate v3 API types (`pnpm --filter @vibe/api generate` against the backend from group 3) and add `studyMode` to the lesson type in `features/learn/queries.ts`. Make blue-track reads send `mode=study`. Verify with `npx tsc -b apps/student/tsconfig.app.json apps/student/tsconfig.spec.json`.
- [ ] 4.2 Relabel the tracks to "Study mode" / "Strict mode" in `tracks.ts`, keeping the `blue`/`green` ids, saved choices and `?track=`. Update copy that says "certified mode" (`lesson-page.tsx`, `course-page.tsx`, Studio's `course-proctoring.tsx:77`, `editor/quiz-results.tsx:132`). Test that a stored `green` choice opens as strict mode and the switcher shows both labels.
- [ ] 4.3 Study mode:
  - drop the linear lock from the blue outline (`course-page.tsx:312`) and its notice (`:393`);
  - remove the camera requirement from `BlueLesson`;
  - mark items whose `studyMode.allowed` is false as strict-mode only in the outline;
  - on a `STUDY_MODE_DISABLED` 403, show the instructor-disabled notice naming the level, with a "Switch to strict mode" action;
  - on a quiz, show the strict-on-a-computer notice.

  Add Vitest + Testing Library tests for each scenario in `specs/v3/study-mode` (linear course opens ahead, no progress call made, disabled notice per level, quiz notice, outline marks) and verify with `npx vitest run --root apps/student`.
- [ ] 4.4 Strict mode is PC-only. Add a `usePrimaryTouch()` hook (`matchMedia('(pointer: coarse)')`, reacting to changes) and gate the green lesson and quiz pages behind a shadcn "Continue on a computer" screen, offering study mode when the item allows it. Tests cover a phone (blocked, no progress or attempt calls, study offered only when allowed), a mouse-primary device (normal flow), and the existing green-track tests still passing. Verify with `npx vitest run --root apps/student`.

## 5. v3 Studio: study-mode switches and linear fix

- [ ] 5.1 Add a study-mode `Select` (On / Off / Inherit) to the module, section and item menus in `features/admin/course-content.tsx`, using mutations against the group-2 endpoints, with "Study mode off" and "(inherited)" badges computed from the node's own value and its parents'. Revert the value and show a sonner error toast if a save fails. Tests cover disabling a module, overriding one item inside it, and a save failure. Verify with `npx vitest run --root apps/student`.
- [ ] 5.2 Change `linearProgressionEnabled ?? false` to `?? true` in `course-proctoring.tsx:56-57` and `course-registration.tsx:182-183`. Add a test that saving settings for a course with an unset linear value sends `true`. Run `npx vitest run --root apps/student` and the `tsc -b` command from 4.1, and confirm they pass.

## 6. Production frontend

- [ ] 6.1 Regenerate the API schema (`pnpm copy && pnpm gen-schema` in `frontend/`). Add `useUpdateModuleStudyMode`, `useUpdateSectionStudyMode` and `useUpdateItemStudyMode` to `hooks/hooks.ts`, modelled on `useUpdateItemProctoring`. Verify with `pnpm typecheck`.
- [ ] 6.2 Add the On / Off / Inherit study-mode control to the module, section and item side panels in `app/pages/teacher/teacher-course-page.tsx`, next to the proctoring override panels (`:2966-3120`), showing the effective value and "(inherited)". Put the inherited-value calculation in a small pure helper and test it in a `*.test.ts` next to it, covering module off, item override and inherit reset.
- [ ] 6.3 Phone study viewing in `app/pages/student/course-page.tsx`, at the `isMobile && !allProctorsDisabled` branch (`:1811`):
  - for a video whose `studyMode.allowed` is true, re-read with `mode=study` and render the player in study mode: no proctoring components, no start/stop calls, seeking allowed, and a "Study mode: doesn't count towards progress" banner;
  - otherwise render `MobileFallbackScreen` with an optional instructor-disabled line naming the level.

  Keep the all-detectors-off path unchanged. Put the decision in a pure function (`phoneLessonMode(item, isMobile, allProctorsDisabled)` returning `study`, `fallback` or `normal`) and test every scenario in `specs/frontend/study-mode`. Verify with `pnpm test && pnpm typecheck`.

## 7. End-to-end check

- [ ] 7.1 Against a local backend with the group-3 build and a test course (linear on, one module disallowing study mode, one item inside it allowed, one quiz):
  - v3 at phone size and desktop, and the production app at phone width and desktop, behave as the specs say;
  - the student's progress document is unchanged after every study-mode visit.

  Record the results in the backend PR description.

## Workflow follow-up

- Merge the backend PR and deploy it before either frontend PR, since both call the new endpoints and `?mode=study`.
- Archive the change after all three PRs merge.
