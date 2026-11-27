# Proposal

## Why

Quizzes are taken only in strict mode, yet study mode still lists them in the course outline, steps onto them with Previous/Next and can point "Study where you left off" at one, only to show a notice saying to switch modes. Students studying (often on phones, where strict mode isn't available) hit dead ends. Study mode should show only what can be studied.

## What Changes

- In study mode, quizzes no longer appear in the course syllabus, and sections or modules that contain only quizzes are hidden.
- Study mode's lesson and module counts leave quizzes out.
- Study mode's Previous/Next skip quizzes, and "Study where you left off" goes to the next lesson after a quiz instead of the quiz.
- A direct link to a quiz in study mode still shows the existing notice with "Switch to strict mode", so bookmarks don't break.
- Strict mode is unchanged. Study progress already counts only videos and articles, so it doesn't change.

## Capabilities

### New Capabilities
<!-- None. -->

### Modified Capabilities
- `v3/study-mode`: "Quizzes are strict-mode only" now also hides quizzes from study mode's outline, counts and navigation.

## Impact

- v3 only (`features/courses/course-page.tsx`, `features/learn/lesson-page.tsx` study track, `features/study-mode/study-mode.ts` shared helper). No backend changes.
