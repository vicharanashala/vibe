# Proposal

## Why

A student's progress today means **strict progress** only: lessons completed in strict mode, which drive completion and certificates. Study mode records nothing, so a student who works through a course on their phone sees 0%, and teachers can't tell whether anyone uses study mode.

A separate **study progress** figure shows how much of the material each student has covered. It leaves the official, strict number alone.

## What Changes

**When a lesson counts as studied**
- An **article** counts when it is opened in study mode.
- A **video** counts once about 10 seconds of it have actually played in study mode, or all of it if the clip is shorter.
- Quizzes and other lesson types never count.

**How study progress is calculated**
- It is worked out per student and course version. The total is every visible video and article where **study mode is allowed**; lessons the teacher has made strict-only are left out, so 100% is reachable.
- A lesson counts as covered if it was studied, **or** completed in strict mode, so study progress never shows less than what the student has actually done.
- It is calculated when asked for, never stored, so it follows the teacher's study-mode settings as they change.

**Unchanged**
- Strict progress (`percentCompleted`, completion, current lesson) is exactly as today.
- A study-mode lesson read still never touches progress. Studying is recorded by a separate request, in a separate collection.

**Backend**
- A collection of study views: one record per student, course version and lesson, holding when it was first studied.
- An endpoint the app calls to record a study view. It checks that the caller is enrolled as a student, that the lesson is a video or article in the version, and that study mode is allowed for it.
- An endpoint returning the student's study progress: lessons covered, total, percentage, and which lessons count.
- The course's enrollment list for teachers gains each student's study progress.

**v3 student app**
- Study mode records study views: articles on open, videos after about 10 seconds of playback.
- The course page shows study progress next to strict progress.
- The study-mode outline marks lessons already covered.
- Course cards show the study percentage under the strict one.
- Copy changes from "nothing counts towards your progress" to "doesn't count towards your strict progress".

**v3 Studio**
- The People tab gains a Study progress column next to the existing progress.

No breaking changes:
- The new endpoints and the new list field are additive.
- Existing progress values and screens keep their meaning.

## Capabilities

### New Capabilities
- `backend/study-progress`: recording study views and calculating a student's study progress, including the teacher's per-student view.
- `v3/study-progress`: how the v3 student app records study views and shows study progress, and how Studio shows it per student.

### Modified Capabilities
- `v3/study-mode`: "Study mode is free viewing" no longer says study mode saves no progress. It still saves no strict progress, and now records study views.

## Impact

- **Backend:**
  - a `studyViews` collection with a unique index on student, version and item;
  - a repository;
  - study-view and study-progress logic in `users` (`ProgressService` / `ProgressController`), reusing the study-mode resolver (`resolveStudyMode`) and the strict completed-items lookup;
  - an extra field in the course enrollment list (`EnrollmentService`).
- **v3:**
  - `features/learn` (the study lesson, and video playback time from the player's `onPlayingChange`);
  - `features/courses` (course page, outline, course cards);
  - `features/admin/course-people.tsx`;
  - regenerated API types.

  The v3-only rule doesn't apply to the backend part, which is its own commit and lands first, as with study mode.
- **Production frontend:** not part of this change. Its phone study viewing won't record study views yet, so a student's study progress there only reflects strict completions and v3 study views. That's a possible follow-up.
- **Depends on:** the study-mode specs from #1504, which this change modifies.
