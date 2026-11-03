# Tasks

Backend first (groups 1–2), then v3 (groups 3–4).
- **Backend tests:** run from `backend/` with `npx vitest run <file>`, and the format check with `bash .github/scripts/check-backend-format.sh origin/main <out-file>`.
- **v3 checks:** run from `v3/` with `npx vitest run --root apps/student` and `npx tsc -b apps/student/tsconfig.app.json apps/student/tsconfig.spec.json`.

## 1. Backend: study views and study progress

- [x] 1.1 Add the `studyViews` repository:
  - model `{ userId, courseId, courseVersionId, itemId, firstStudiedAt }` with a unique index on `{ userId, courseVersionId, itemId }`, created in `init`;
  - `recordView` (upsert with `$setOnInsert`) and `findViews(courseVersionId, userIds, itemIds)`;
  - `ItemRepository.readItemsGroupsByIds`, a raw `$in` find that keeps `studyModeEnabled` on the refs.

  Verify with repository tests: recording twice keeps one document and the first time; `findViews` filters by users and items.
- [x] 1.2 Add the study-progress calculation (`forUsers(courseId, versionId, users)`, design decision 2):
  - eligible = visible `VIDEO`/`BLOG` refs where `resolveStudyMode` allows;
  - covered = eligible ∩ (study views ∪ `getCompletedItems` with the enrollment's cohort);
  - rounded percentage, and 0 of 0 gives 0%.

  Unit-test every scenario of "Study progress calculation" in `specs/backend/study-progress`: a study/strict mix, strict-only and quiz lessons left out, study mode disabled after studying, nothing studyable.

## 2. Backend: endpoints and teacher list

- [x] 2.1 Add the two endpoints to `ProgressController` with their validators and OpenAPI schemas:
  - `POST /users/progress/courses/:courseId/versions/:versionId/study-views` (body `{itemId, moduleId, sectionId}`);
  - `GET /users/progress/courses/:courseId/versions/:versionId/study-progress`.

  Rules (design decision 3): only the caller's own enrollment; the item must be in that section of the version; 400 for non-video/article items; 403 `STUDY_MODE_DISABLED`; instructors get `{recorded: false}`.
- [x] 2.2 Add `studyProgress` to STUDENT entries of `GET /users/enrollments/courses/:courseId/versions/:versionId` (`null` for other roles), computed with one `forUsers` call per page. Leave `progress` unchanged.
- [x] 2.3 Add integration tests in a new `backend/src/modules/users/tests/StudyProgress.test.ts`, using the authenticated harness of `courses/tests/StudyMode.test.ts`, covering every scenario in `specs/backend/study-progress`:
  - record and re-record;
  - quiz → 400, disabled → 403, not enrolled, other version → 404, instructor not stored;
  - the progress read, with strict progress unchanged;
  - the enrollment list field.

  Run the full backend suite (excluding CI's known-broken files) and the format check, and confirm both pass.

## 3. v3 student app

- [x] 3.1 Regenerate the API types against the backend from group 2.
- [x] 3.2 Add `useStudyProgress(courseId, versionId)` and `recordStudyView(ref)` in `features/learn/queries.ts`. A successful record invalidates the study-progress query.
- [x] 3.3 Add the `useStudyViewRecorder(ref, item)` hook (design decision 4), used by `BlueLesson`:
  - articles record on mount;
  - videos record after `min(10, clipLength)` seconds of playing time, counted from `onPlayingChange`;
  - once per visit, failures silent.

  Test it with fake timers: an article records once; a video records after 10 s of playing in two pieces, not after 9 s or while paused, records a 6 s clip at 6 s, and makes no call in strict mode.
- [x] 3.4 Show study progress:
  - the study line and bar on the course page;
  - sky-coloured "studied" checks in the study outline, from `studiedItemIds`;
  - "Study N%" on course cards, via `useStudyProgress` per card;
  - the new study-mode description copy.

  Tests cover the course page line (4 of 8 · 50%), the outline mark, a card percentage, the hidden line when the query fails, and updated copy assertions. Verify with `npx vitest run --root apps/student` and the `tsc -b` command.

## 4. v3 Studio

- [x] 4.1 Add a "Study" column to the People table in `features/admin/course-people.tsx`, from `studyProgress.percentStudied` ("—" for non-students), hidden on small screens like the existing Progress column. Test that a student row shows the percentage and an instructor row shows "—". Run the full v3 checks (`nx run-many -t lint typecheck --projects=student,api,proctoring` plus vitest) and confirm they pass.

## 5. End-to-end check

- [ ] 5.1 Against the local stack (backend :4002, v3 :4310, test course "E2E: Study mode"):
  - open an article in study mode and play a video for over 10 s (or confirm the recorder's request fires, since YouTube playback is blocked on the server);
  - check the course page, outline and card update, Studio People shows the student's study %, and strict progress in the progress document is unchanged.

  Record the results in the PR description.

## Workflow follow-up

- Merge #1504 (study-mode spec archive) before this change's PR. This change modifies `v3/study-mode`.
- Deploy the backend before `deploy-frontend-v3`.
- Archive this change after its PR merges and deploys.
