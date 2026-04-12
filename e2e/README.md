# E2E Tests (Playwright)

This directory contains end-to-end (E2E) tests for the frontend application
using Playwright.

The initial setup focuses on a single, fast smoke test that verifies the
frontend application boots and renders its basic shell without crashing.

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

Run only the smoke test:

```
pnpm --dir e2e exec  playwright test  e2e/tests/smoke.spec.ts
```

---

## Current Test Scope

The current E2E coverage is intentionally minimal and limited to a smoke test:

- Verifies the frontend application loads successfully
- Confirms the application shell renders
- Ensures the UI does not crash on startup

The smoke test does **not** validate business logic, API responses, or user
flows. Additional E2E coverage will be added incrementally in future changes.

---

## Assumptions

- The frontend application is already running before tests are executed.
- Tests use the `baseURL` configured in `playwright.config.ts`.

If the frontend is not running, start it with:

```
vibe start frontend
```

The following environment variables need to set in test application
TEST_STUDENT_EMAIL=
TEST_STUDENT_PASSWORD=

The following environment variables need to set in front end env file
VITE_E2E_TESTING=true

---

## Artifacts

Playwright generates test artifacts such as screenshots, traces, and videos
under the `e2e/` directory. These files are ignored via `.gitignore` and are
not committed to the repository.

---

## Notes

- The Playwright setup is intentionally minimal to keep the smoke test fast and
  reliable.
