# Design

## Context

See proposal.md for the why, and the specs for the behaviour. What the approach builds on:

**Study mode is the template.** A tri-state `studyModeEnabled` sits on modules, sections and ItemsGroup refs, `resolveStudyMode` resolves it, and three `PUT …/study-mode` endpoints with audit actions set it. `StudyModeError` gives the apps a named 403. Both frontends have a small client resolver and teacher controls. Locking copies this shape.

**Checked against the code, no test run yet:**
- `getNextItemInSequence` filters only hidden, deleted and blank-quiz lessons, so it moves onto a locked lesson with no change. `isCompleted = !nextItem` therefore stays false, which is what "wait" needs.
- In `readItem`, the pointer only moves after the checks that a new guard would run before, so a refused read can't move a student.
- `readItemsGroup` rebuilds refs from an allowlist, and callers write the array back. A field missing there is erased on the next hide or reorder.
- `CourseTransferService` copies fields explicitly in both directions.
- `POST /quizzes/:quizId/attempt` receives no course or version, and `readItem` doesn't check that the URL's module and section contain the item.
- The production app calls stop after a quiz is submitted, passing `attemptId`. v3 doesn't call stop for quizzes; the submission moves its progress.

## Goals / Non-Goals

**Goals:**
- One server-side check, used by every student write and read of a lesson.
- No change to next-lesson logic, completion, progress totals or stored progress.
- Hard to bypass: the lock is worked out from the lesson's real position.

**Non-Goals:**
- Scheduled locks and unlocks. Manual only, by user decision.
- Per-student or per-cohort locks.
- Notifying students when something locks or unlocks.
- Blocking `save` and `submit` on an attempt in progress, or `upsertWatchTime`, which only updates a last-seen time and can't complete a lesson.
- Two existing gaps found while reading this code, both left for a separate decision:
  - `readItem` doesn't check `isHidden`, so a hidden lesson opens by direct link for an enrolled student;
  - the study-mode check trusts the URL's module and section, so wrong ids resolve to "allowed".

## Decisions

### 1. `isLocked`, shaped like the study-mode setting
`isLocked?: boolean | null` on modules, sections and ItemsGroup refs: `true` locked, `false` open, absent or `null` inherit. `resolveContentLock(item, section, module)` in `models.ts` returns `{locked, source}`, where source is `item`, `section`, `module` or `default`.

Not cascaded: resolved when read, so one lesson can stay open inside a locked module and clearing a module's lock restores everything below it.

*Alternative:* cascade onto children, as hiding does. That would overwrite each lesson's own choice, and unlocking couldn't tell what was individually set.

### 2. Endpoints next to study mode
- `PUT /courses/versions/:versionId/modules/:moduleId/lock`
- `PUT /courses/versions/:versionId/modules/:moduleId/sections/:sectionId/lock`
- `PUT /courses/versions/:versionId/items/:itemId/lock`

The body is `{isLocked: true | false | null}`, with the same abilities, archived-version check and in-this-version check as the study-mode endpoints. New audit actions: `MODULE_UPDATE_LOCK`, `SECTION_UPDATE_LOCK`, `ITEM_UPDATE_LOCK`.

### 3. One `ContentLockService`, driven only by the item id
`assertOpenForUser(userId, itemId)`, bound in the courses container and depending only on repositories, so it adds no service cycles:
1. `findItemsGroupByItemId` for the raw ref. This repository call doesn't use the allowlist.
2. `getItemGroupInfo` for where that group sits, then `readVersion` for the module and section.
3. `resolveContentLock`. If it's open, return.
4. Look up the caller's enrollment for that course and version without a cohort filter, as `readItem`'s retry does. If they have a non-student role, return.
5. Otherwise throw `ContentLockedError`.

Because it takes only the item id, it works for quiz attempts, which have no version in the request, and URL ids can't change the answer. An item that can't be placed in a version counts as open, and the existing checks handle it. Someone with no enrollment is refused while the lesson is locked. Open lessons never pay for the enrollment lookup.

*Alternative:* pass in the version and ids each caller already has. That saves a read or two, but brings back the trust in client ids and leaves attempts unsolved.

### 4. `ContentLockedError`
A 403 with `name: 'CONTENT_LOCKED'` and `details.source`, like `StudyModeError`. The apps read `name`. Message: "The instructor has locked this {module | section | lesson}."

### 5. Where the guard runs

| Path | Placement |
|---|---|
| `ItemService.readItem` | Student branch only, before the study-mode and linear checks |
| `ProgressService.startItem` | Before the already-completed short-circuit |
| `ProgressService.stopItem` | After the completed no-op, so retries of finished lessons stay safe; see decision 6 |
| `ProgressService.skipItem` | Start of the method |
| `StudyProgressService.recordStudyView` | With its other checks, using the lock resolved in `lessonsOf`, for students |
| `AttemptService.attempt` | Before its transaction, so no metrics document is created or attempt used | The route also gets `@ContentType('application/json')`: `AttemptController` isn't a `JsonController`, so the app's default error handler otherwise answers in text, and clients can't read the refusal's `name` |
| `AttemptService.submitFeedBackForm` | Before its transaction |
| `ProjectService.submitProject` | Before its transaction |

`adminAdvanceStuckStudent`, resets and other staff actions aren't guarded.

### 6. `stopItem` allows finishing a submitted quiz
A submission's own progress update isn't guarded, but the production app calls stop afterwards, and a refusal would show an error after a successful submit. So if the item is a `QUIZ`, the request has an `attemptId`, and `submissionRepository.get` finds a submission for it, the guard is skipped. All other stops of a locked lesson are refused, so a video locked mid-watch doesn't complete.

### 7. Student outlines work it out on the client
`getVersion` and `readItemsGroup` return each level's own `isLocked`, so outlines resolve it with a client copy of the rule, as they do for study mode (`features/content-lock` in v3, `utils/contentLock.ts` in production), and need no extra requests. A section's lessons load when it's opened, so section and module headers use their own resolved value.

The lesson response doesn't carry the lock. A student who can read a lesson doesn't need it, and staff see it in the editor.

### 8. v3 screens
- **Studio:** a "Lock" submenu in `RowMenu` next to Study mode, and a `LockBadge`, both following `StudyModeSubmenu` and `StudyModeBadge`, including `mutateAsync().catch` because the menu unmounts when an option is picked.
- **Lesson page:** `contentLockRefusal(error)` is checked before `strictOnTouch`, so phones get the right screen. New `ContentLockedLesson` with a "Back to the course" link. It doesn't offer "next lesson", which in a linear course would be this same lesson.
- **Start and stop:** a `CONTENT_LOCKED` refusal invalidates the lesson query, so the normal read refusal brings up the screen.
- **Outline:** a lock icon and label. A completed lesson keeps its check and also gets the lock. Rows stay links and lead to the locked screen.

### 9. Production screens
- **Teacher page:** `ContentLockPanel` next to `StudyModePanel` in the selected-entity panel, with `contentLockState` and new hooks using `putLock` and the same invalidation.
- **Course page:** `isItemLocked` returns true first for resolved locks, before its linear-only early return, so `CourseDrawer` shows them in non-linear courses too.
- **Lesson errors:** `CONTENT_LOCKED` has its own name, so it skips the `ForbiddenError` branch and its "lessons unlock in order" text. A new branch follows the same revert-to-previous behaviour, with its own message. With no previous lesson, the lesson area shows the message.
- **Fullscreen:** the "Fullscreen required" overlay isn't shown over the locked message, because no lesson is running.
- **Phone:** `PhoneStudyLesson` shows the instructor message instead of the use-a-computer fallback.

## Risks / Trade-offs

- **A lesson locked mid-watch isn't completed.** → Intended. The student sees the locked screen and watches it again after unlocking. The open watch-time record is harmless.
- **A student in a quiz who reloads can't get back in.** → The read is refused while locked, so the attempt can't be reopened. v3 and production both have `refetchOnWindowFocus` off, so this needs a real reload. Accepted, because letting the read through would expose a locked quiz's questions. Reopening it after unlocking works as it does today.
- **Non-linear "continue" can land on a locked lesson.** → `findFirstIncompleteItemInSequence` doesn't skip locks. The student sees the locked screen and uses the outline. Kept, to leave next-lesson logic alone.
- **A student can't reach 100% while an unfinished lesson stays locked.** → Follows from counting locked lessons in totals, as decided. The teacher controls this.
- **Three extra reads per guarded call.** → Small, indexed lookups on paths that already read several documents. `stopItem` and `readItem` already read the version, so this could be shared later without changing behaviour.
- **Client copies of the rule could drift from the backend.** → They only affect icons, and the backend decides access. Each has unit tests for the same cases.
- **Old frontends during deploy** show a generic error for a locked lesson. Nothing is locked until a teacher uses the new controls, so deploy all three close together.

## Migration Plan

1. Backend commit first: field, resolver, endpoints, guards, tests.
2. Then v3 (with regenerated API types) and the production frontend.

Deploy the backend, then `deploy-frontend-v3` and `deploy-frontend`. No data changes.

Rollback: revert the frontends and backend. Stored `isLocked` values are ignored by the old code, so everything opens again. Note that this means a held-back lesson would become available.
