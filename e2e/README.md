# E2E Tests (Playwright)

This directory contains end-to-end (E2E) tests for the frontend application
using Playwright.

Current coverage validates the student learning flow, including learner login,
course traversal, lesson completion, and progress verification.

---

## Prerequisites

- Node.js **18+**
- pnpm
- A running frontend dev server on `http://localhost:5173`

---

## Installing Dependencies

From the repository root, install all workspace dependencies:

```
pnpm install
```

Install Playwright browser binaries (one-time setup):

```
pnpm --dir e2e exec  playwright install
```

---

## Running Tests (sample commands that can be run from root folder)

Run all E2E tests:

```
pnpm --dir e2e test-e2e
```

Run only course playback + quiz traversal:

```
pnpm --dir e2e exec playwright test tests/play-course-vidoes.test.ts
```

Note: the test file path contains a legacy typo (`vidoes`) and is kept as-is
to avoid breaking existing references.

Run progress status assertion (expects 100% completion):

```
pnpm --dir e2e exec playwright test tests/test-progress-status.test.ts
```

---

## Current Test Scope

The current E2E coverage validates student course completion behavior:

- Learner authentication from the login flow
- Course card discovery and course launch
- Module/section/item traversal for supported lesson types
- Video completion handling with robust playback waits
- Quiz answering and submission loop
- Project submission flow
- Completion percentage assertion in progress-status scenario

The tests are UI-driven and exercise integrated behavior. They are not a full
replacement for backend contract/API tests.

---

## Assumptions

- The frontend application is already running before tests are executed.
- Tests use the `baseURL` configured in `playwright.config.ts`.

If the frontend is not running, start it with:

```
vibe start frontend
```

Set these environment variables for test authentication:

```
TEST_STUDENT_EMAIL=
TEST_STUDENT_PASSWORD=
```

Optional variable for selecting a target course by title:

```
COURSE_NAME=
```

Set this in frontend env configuration for test-friendly behavior:

```
VITE_E2E_TESTING=true
```

---

## Artifacts

Playwright generates test artifacts such as screenshots, traces, and videos
under the `e2e/` directory (for example `test-results/` and
`playwright-report/`). These files are ignored via `.gitignore` and are not
committed to the repository.

---

## Notes

- Tests run in a single worker to reduce cross-test interference for shared
  learner/course state.
- The course traversal helper contains resilience logic (polling and guarded
  waits) to tolerate real-world UI/network timing variance.
