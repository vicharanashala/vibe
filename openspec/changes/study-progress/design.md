# Design

## Context

See proposal.md for the why, and the specs for the behaviour. What the approach builds on:

**Strict progress**
- A per-enrollment cache, `enrollment.percentCompleted`, recalculated when an item completes.
- Completed items come from `ProgressRepository.getCompletedItems`: distinct `watchTime` items with an `endTime`, cohort-aware, excluding hidden and deleted items.
- This change doesn't touch any of that.

**Study mode**
- Resolved per item by `resolveStudyMode(itemRef, section, module)`.
- The item's own setting lives on its ItemsGroup ref.
- A study read (`?mode=study`) never writes anything, and that stays true.

**The v3 study lesson**
- `BlueLesson` in `features/learn/lesson-page.tsx` renders `LessonContent`.
- For videos that's our `YouTubePlayer`, which reports `onPlayingChange` and the clip's `start`/`end`.

**Studio People tab**
- `features/admin/course-people.tsx` reads `e.progress` from `GET /users/enrollments/courses/:courseId/versions/:versionId`, which is paged (`page`/`limit`, default 10).

## Goals / Non-Goals

**Goals:**
- Study progress that can't drift: always computed from the current structure and settings.
- No change to strict progress data, endpoints or meaning.
- Cheap enough to show on Studio's People page without per-row requests.

**Non-Goals:**
- Recording study views from the production frontend's phone study viewing (a later follow-up).
- Module-level study progress, study progress in reports or exports, and per-lesson study times in Studio.
- Anti-cheating checks on the 10-second watch. It's a coverage signal, not a grade.
- Backfilling. Nobody has study views yet, and strict completions already count.

## Decisions

### 1. A `studyViews` collection, not a field on progress or enrollment
Each document is `{ userId, courseId, courseVersionId, itemId, firstStudiedAt }`, with a unique index on `{ userId, courseVersionId, itemId }` created in the repository's `init`, the way other repositories create theirs. Recording is an upsert with `$setOnInsert`, so repeats are cheap and keep the first time.

*Alternatives:*
- **An array of studied ids on the enrollment.** It would couple study data to the strict progress document and its transactions, and race on concurrent appends.
- **A cached study percentage.** It would go stale whenever a teacher changes study-mode settings, which spec scenario "Teacher later disables study mode" rules out.

### 2. Compute study progress on read, from one structure pass
`StudyProgressService.forUsers(courseId, versionId, users[])`:
1. Read the version once.
2. Load every visible section's ItemsGroup in **one** query: a new `ItemRepository.readItemsGroupsByIds`, a raw `find({_id: {$in}})`. It's raw so the refs keep `studyModeEnabled`, unlike `readItemsGroup`'s allowlist.
3. Build the eligible set: visible `VIDEO`/`BLOG` refs whose resolved study mode is allowed.
4. Read study views for all the users in one query: `{courseVersionId, userId: {$in}, itemId: {$in: eligible}}`.
5. For each user, call `getCompletedItems` with their enrollment's `cohortId`.
6. covered = eligible ∩ (studied ∪ completed). The percentage is `round(100 × covered / total)`, and 0 when total is 0.

The student endpoint calls it for one user. The teacher list calls it for the page's student entries, so the cost is one structure pass plus one study-view query plus one completed-items query per row, bounded by the page size.

### 3. Endpoints, next to the existing progress endpoints
- **`POST /users/progress/courses/:courseId/versions/:versionId/study-views`**, body `{ itemId, moduleId, sectionId }`:
  - checks the caller's own enrollment (cohort-agnostic retry, as `readItem` does), and that the item is in that section of the version;
  - rejects non-`VIDEO`/`BLOG` items with 400;
  - rejects items where study mode resolves to off with a 403 `StudyModeError('STUDY_MODE_DISABLED')`, the existing error class;
  - only records for the `STUDENT` role; an instructor's call returns `{ recorded: false }`.
- **`GET /users/progress/courses/:courseId/versions/:versionId/study-progress`** returns `{ studiedItems, totalItems, percentStudied, studiedItemIds }` for the caller.
- **The course enrollment list** gains `studyProgress: { studiedItems, totalItems, percentStudied }` on STUDENT entries; others get `null`. It's additive, and `progress` is unchanged.

Both endpoints act only on the caller (no `userId` in the path), so no new ability rules are needed beyond `@Authorized` and the enrollment check.

### 4. v3 records from `BlueLesson` with a small hook
`useStudyViewRecorder(ref, item)`, used by the study lesson only:
- **Articles:** record on mount.
- **Videos:** accumulate *playing* time from `onPlayingChange` (start a clock when playing and stop it when paused, so seeks and pauses don't count). Record once the total reaches `min(10, clipLength)` seconds, where clipLength = `end − start`, or 10 when `end` isn't set.
- **Once per visit:** a ref guards against repeat calls. Failures are silent, because study recording must never interrupt viewing; the next visit retries.
- **Afterwards:** a successful record invalidates the study-progress query, so the course page and outline update.

*Alternative:* recording on the server side of the study read. The user chose "watched a bit", which the server can't observe.

### 5. Where v3 shows it
- **Course page:** a second line under "Your progress", e.g. "Study mode: 4 of 8 videos & articles · 50%", with a small progress bar in the study (sky) colour. Strict progress stays the main figure.
- **Study outline:** studied lessons get a sky-coloured check, distinct from the strict "Completed" check, from `studiedItemIds`.
- **Course cards:** each student card runs its own `useStudyProgress` query (cached, 60 s) and shows "Study 50%" under the strict bar. Students have few enrollments, so this beats widening the student enrollment list.
- **Studio People:** a "Study" column with the percentage, from the new list field.
- **Track copy:** the study description changes to "…Doesn't count towards your strict progress…".

## Risks / Trade-offs

- **A large People page costs one completed-items query per row.** → It's bounded by the page size (default 10, as Studio uses now). If teachers start loading big pages, switch to a single aggregation over `watchTime` grouped by user. That's an internal change; the response stays the same.
- **The 10-second rule is client-side and can be faked.** → Acceptable for a coverage signal that never affects strict progress or certificates (Non-Goals).
- **Recording fails while offline.** → It's silently skipped and the next visit records it. Losing one study mark is harmless.
- **Strict completions count towards study progress.** → Intended (user decision), and stated in the copy as "covered", so it isn't read as "studied in study mode only".

## Migration Plan

1. Backend commit first: collection, index, endpoints, enrollment-list field, tests.
2. Then the v3 commit, which regenerates API types.

Deploy the backend before `deploy-frontend-v3`. A v3 build that's ahead of the backend gets 404s from the new endpoints: recording fails silently, and the study line is hidden when its query errors.

Rollback: revert the frontends, which removes the display. The `studyViews` documents are harmless to keep.
