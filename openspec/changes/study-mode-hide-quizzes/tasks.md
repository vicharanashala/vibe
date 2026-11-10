# Tasks

Checks from `v3/`: `npx vitest run --root apps/student` and `npx tsc -b apps/student/tsconfig.app.json apps/student/tsconfig.spec.json`.

## 1. Hide quizzes in study mode

- [x] 1.1 Add the shared `hiddenInStudyMode`/`itemsForTrack` helper in `features/study-mode/study-mode.ts`; verify with a unit spec
- [x] 1.2 Course page: drop quizzes from study-mode section lists, hide quiz-only sections and modules, leave quizzes out of study-mode counts, and continue to the next non-quiz lesson; verify with specs in `features/study-mode/study-mode-quizzes.spec.tsx`
- [x] 1.3 Study track Previous/Next skip quizzes; verify with a spec
- [x] 1.4 Keep the direct-link notice for a quiz in study mode; verify with a spec

## 2. Integration check

- [ ] 2.1 Run the full v3 checks (vitest, tsc, nx lint and typecheck) and `openspec validate --all --strict`; capture before/after screenshots for the PR
