# Proposal

## Why

Teachers can't close part of a course for a while, for example to release a module on a set day, hold back an exam, or pull a lesson that has a mistake. Hiding removes the content from the outline and from progress totals, and turning off linear progression does nothing for one lesson. Teachers need to close a module, section or lesson for everyone, and open it again, without changing anyone's progress.

## What Changes

**The setting**
- Modules, sections and lessons each get a lock setting: locked, open, or inherit. A lesson uses its own setting, then its section's, then its module's. With nothing set it's open, so all existing content stays open.
- One lesson can stay open inside a locked module, by setting it to open.
- The teacher locks and unlocks by hand. There's no schedule.

**What a locked lesson means for a student**
- It can't be opened, in strict or study mode, even if the student already finished it.
- It stays visible in the outline with a lock icon, and still counts in progress totals, so percentages don't jump when a teacher locks something.
- Progress is never changed. Students already past a locked lesson aren't pulled back, and it opens again as soon as it's unlocked.
- **Linear courses:** a student who reaches a locked lesson waits there. The current lesson moves onto it as usual, it shows as locked, and later lessons stay closed because the linear rule still applies.
- **Non-linear courses:** only the locked lessons are closed.
- **Quizzes:** new attempts are refused. A student already in an attempt can still save and submit it.

**Who it applies to**
Students only. Instructors and other course staff keep full access, so they can check content while it's locked.

**Enforcement**
The backend refuses locked lessons with a 403 `CONTENT_LOCKED` at every student entry point: lesson reads, start, stop, skip, study views, new quiz attempts, and feedback and project submissions.

**Screens**
- **v3 Studio and the production teacher page:** set the lock on any module, section or lesson, and see what's locked or inherited.
- **v3 student app and the production student pages:** a lock icon in the outline, and a "locked by your instructor" screen instead of the lesson.

**Unchanged**
- Next-lesson logic, completion rules and progress totals.
- Hiding, linear progression, study-mode settings and time slots. A lock is an additional check on top of them.
- Teacher actions such as resetting or advancing a student.

No breaking changes: the setting is optional, and absent means open.

**Assumption:** copying or transferring a course version keeps its locks, as with study-mode settings. Keeping a held-back exam closed is the safer default.

## Capabilities

### New Capabilities
- `backend/content-locking`: the lock setting, its inheritance, teacher endpoints, and refusing students at every entry point.
- `v3/content-locking`: lock controls in ViBe Studio, and the outline and lesson screens in the v3 student app.
- `frontend/content-locking`: lock controls and student screens in the production app.

### Modified Capabilities

None. A lock takes priority over the study-mode rules without changing them, and `backend/content-locking` states that priority.

## Impact

- **Backend** (its own commit, landing first):
  - `isLocked` on modules, sections and item refs, in `models.ts`, the transformers, `ItemRepository.readItemsGroup`'s allowlist and `CourseTransferService`;
  - three `PUT …/lock` endpoints with audit actions, next to the study-mode ones;
  - a new `ContentLockService` and `ContentLockedError`;
  - guards in `ItemService.readItem`, `ProgressService` (`startItem`, `stopItem`, `skipItem`), `StudyProgressService`, `AttemptService` (`attempt`, `submitFeedBackForm`) and `ProjectService.submitProject`.
- **v3:** `features/admin/course-content.tsx` and `queries.ts`, `features/learn/lesson-page.tsx`, `features/courses/course-page.tsx` and `queries.ts`, a new `features/content-lock` helper, and regenerated API types. Studio and the student app share this codebase. The backend part is its own commit, as with study mode.
- **Production frontend:** `teacher-course-page.tsx`, a new panel next to `StudyModePanel`, `hooks.ts`, `student/course-page.tsx`, `CourseDrawer.tsx`, `PhoneStudyLesson.tsx`, and a new `utils/contentLock.ts`.
- **Data:** no migration. **API:** additive, except that locked lessons now return 403 to students.
