# Testing in Vibe

Vibe ships a layered test suite. This document is the runbook: where tests live, what they cover, how to run them, and the rules that keep the suite healthy.

> **Hard rule:** test code lives in dedicated `tests/` trees — **never under `src/`**. Test authors do not modify `src/`; if a function is hard to test, file an issue, do not refactor.

---

## Layers at a glance

| Layer | Where | Runner | What it asserts | Speed |
|---|---|---|---|---|
| Backend unit | `backend/tests/unit/**/*.unit.test.ts` | Vitest | Pure logic, mocked deps (`vi.mock`). One service/method/branch at a time. | < 60s suite |
| Backend integration (API) | `backend/tests/integration/**/*.api.test.ts` | Vitest + supertest + `mongodb-memory-server` | Full HTTP → controller → service → repo → in-memory Mongo round-trip. External SDKs mocked at the boundary. | < 5min suite |
| Frontend unit | `frontend/tests/unit/**/*.unit.test.{ts,tsx}` | Vitest + jsdom | Pure utilities, hooks (`renderHook`), Zustand stores, leaf components. No network. | < 90s suite |
| Frontend integration | `frontend/tests/integration/**/*.integration.test.{ts,tsx}` | Vitest + jsdom + RTL + MSW | Components/pages with TanStack Query + MSW-mocked HTTP. Multi-component flows. | < 3min suite |
| E2E smoke | `e2e/tests/smoke/**/*.smoke.spec.ts` | Playwright (`smoke` project) | Critical path on every PR (login + dashboard + 1 video + 1 quiz). | < 5 min |
| E2E regression | `e2e/tests/regression/**/*.regression.spec.ts` | Playwright (`regression` project) | One spec per fixed-and-shipped bug. Pin behavior so it stays fixed. | < 10 min/spec |
| E2E full | `e2e/tests/full/**/*.{spec,test}.ts` | Playwright (`full` project) | Comprehensive learner + teacher journeys. Nightly + release gate. | up to 60 min |

---

## Running tests locally

### Backend
```sh
cd backend
pnpm test:unit                 # fast, mocked, no DB
pnpm test:unit:watch           # while developing
pnpm test:integration          # in-memory Mongo, supertest
pnpm test:ci                   # both with coverage (matches CI)
pnpm test:ui                   # interactive Vitest UI for unit suite
```

### Frontend
```sh
cd frontend
pnpm test:unit                 # jsdom, no network
pnpm test:integration          # jsdom + MSW
pnpm test:ci                   # both with coverage
pnpm test:ui                   # interactive Vitest UI
```

### E2E
```sh
cd e2e
pnpm install-browsers          # one-time: install Chromium
pnpm test:smoke                # PR-gate subset (~5 min)
pnpm test:regression           # all pinned regression scenarios
pnpm test:full                 # nightly suite (long)
pnpm test:pr                   # smoke + regression in one shot
pnpm test:report               # open the last HTML report
```

For local-only e2e against fake data, see `e2e/local/` (gitignored, owned by individual developers).

---

## Naming conventions

| File pattern | Layer | Example |
|---|---|---|
| `*.unit.test.ts` (or `.tsx`) | Unit | `backend/tests/unit/modules/users/services/ProgressService.unit.test.ts` |
| `*.api.test.ts` | Backend integration | `backend/tests/integration/courses/CourseController.api.test.ts` |
| `*.integration.test.ts` (or `.tsx`) | Frontend integration | `frontend/tests/integration/components/quiz.integration.test.tsx` |
| `*.smoke.spec.ts` | E2E smoke | `e2e/tests/smoke/critical-path.smoke.spec.ts` |
| `*.regression.spec.ts` | E2E regression | `e2e/tests/regression/gurusetu-export.regression.spec.ts` |
| `*.spec.ts` or `*.test.ts` (under `e2e/tests/full/`) | E2E full | `e2e/tests/full/play-course-videos.test.ts` |
| Helpers (any layer) | Not a test file | `backend/tests/helpers/testApp.ts`, `frontend/tests/helpers/renderWithProviders.tsx` |

Mirror the source path under the corresponding test tree. Source `backend/src/modules/users/services/ProgressService.ts` ↔ test `backend/tests/unit/modules/users/services/ProgressService.unit.test.ts`.

---

## Test shape conventions

### Backend unit (`vi.mock` style)
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FooService } from '#users/services/FooService.js';
import { createMockRepo } from '../../../../helpers/mocks/mockRepository.js';

vi.mock('firebase-admin');
vi.mock('@anthropic-ai/sdk');

describe('FooService', () => {
  let svc: FooService;
  let repo: ReturnType<typeof createMockRepo<IFooRepository>>;
  beforeEach(() => {
    repo = createMockRepo();
    svc = new FooService(repo);
  });

  describe('doThing', () => {
    it('handles the happy path', async () => { /* … */ });
    it('throws on invalid input', async () => { /* … */ });
    it('returns empty when repo returns empty', async () => { /* … */ });
  });
});
```

### Backend integration (`supertest`)
```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { buildTestApp } from '../../helpers/testApp.js';
import { setupTestDb, teardownTestDb } from '../../helpers/testDb.js';
import { studentAuth } from '../../helpers/testAuth.js';

describe('CourseController API', () => {
  let app;
  beforeAll(async () => { await setupTestDb(); app = await buildTestApp({ controllers: [CourseController] }); });
  afterAll(async () => { await teardownTestDb(); });

  describe('POST /courses', () => {
    it('creates a course and returns 201', async () => {
      const res = await request(app).post('/courses').set(studentAuth()).send({ name: 'X' });
      expect(res.status).toBe(201);
    });
  });
});
```

### Frontend unit / hook
```tsx
import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useIsMobile } from '@/hooks/use-mobile';

describe('useIsMobile', () => {
  it('returns true on small viewport', () => {
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(true);
  });
});
```

### Frontend integration (RTL + MSW)
```tsx
import { describe, it, expect } from 'vitest';
import { renderWithProviders } from '@tests/helpers/renderWithProviders';
import { mockEndpoint } from '@tests/helpers/mockApi/handlers.factory';
import CoursePage from '@/app/pages/student/course-page';

describe('CoursePage', () => {
  it('renders a loading state, then the course title', async () => {
    mockEndpoint('get', '/api/courses/c-1', { id: 'c-1', name: 'Vibe 101' });
    const { findByText } = renderWithProviders(<CoursePage courseId="c-1" />);
    expect(await findByText(/Vibe 101/)).toBeInTheDocument();
  });
});
```

### E2E (Playwright)
```ts
import { test, expect } from '@playwright/test';

test.describe('@smoke critical path', () => {
  test('login surface is visible', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
  });
});
```

---

## Coverage targets (industry standard, ratchet-only-up)

| Metric | Initial gate | Q+1 | Steady-state |
|---|---|---|---|
| Lines | 70% | 80% | 85% |
| Branches | 65% | 70% | 75% |
| Functions | 75% | 85% | 90% |

**Critical modules** (auth, progress, attempt grading, ejection policy, payments-adjacent) hold a higher floor: functions 90%, branches 80%.

CI fails on **any** coverage drop. Thresholds only ratchet upward.

Excluded from coverage: generated code (`schema.ts`), `index.ts` re-exports, type-only files (`types/**`, `*.d.ts`), migrations, scripts, test files themselves.

---

## The bug-fix regression rule (highest leverage)

Every PR labeled `bug` **must** add a test that:
1. Fails on the broken commit, and
2. Passes on this fix.

The test references the original incident (commit SHA, issue link, or `// Regression: …` comment).

The `.github/workflows/regression-guard.yml` workflow enforces this — bug-labeled PRs without a test under `backend/tests/`, `frontend/tests/`, or `e2e/tests/regression/` cannot merge.

---

## Helper inventory

### Backend (`backend/tests/helpers/`)
| Path | Purpose |
|---|---|
| `mocks/mockRepository.ts` | `createMockRepo<T>()` — proxy returning `vi.fn()` per method access |
| `mocks/mockFirebase.ts` | Firebase Admin Auth stub |
| `mocks/mockAnthropic.ts` | Anthropic SDK stub |
| `mocks/mockGCS.ts` | Google Cloud Storage stub |
| `mocks/mockMailer.ts` | Nodemailer transporter stub |
| `mocks/mockLogger.ts` | Winston logger stub |
| `fixtures/{user,course,quiz,enrollment,progress}.fixture.ts` | Faker-driven typed factories |
| `testDb.ts` | `mongodb-memory-server` lifecycle |
| `testApp.ts` | Express + routing-controllers boot for integration tests |
| `testAuth.ts` | Synthetic Firebase JWT for supertest |
| `testContainer.ts` | Inversify container with mocks injected |
| `setup.unit.ts` | Per-suite `vi.clearAllMocks()` |
| `setup.integration.ts` | DB lifecycle hooks (`beforeAll` / `afterAll` / `beforeEach`) |

### Frontend (`frontend/tests/helpers/`)
| Path | Purpose |
|---|---|
| `renderWithProviders.tsx` | RTL `render` wrapped in `QueryClientProvider` + `MemoryRouter` |
| `mockApi/server.ts` | MSW server (`setupServer`) |
| `mockApi/handlers.ts` | Default OpenAPI handlers |
| `mockApi/handlers.factory.ts` | `mockEndpoint`, `mockError`, `mockNetworkError` per-test overrides |
| `mockApi/setup.ts` | MSW lifecycle hooks for integration suite |
| `fixtures.ts` | Plain typed factories matching `src/lib/api/schema.ts` |
| `mockMediaRegistry.ts` | Stubs the in-app media registry |
| `mockWorkers.ts` | Stubs comlink workers and `globalThis.Worker` |

---

## CI workflows

| Workflow | Trigger | Purpose |
|---|---|---|
| `.github/workflows/test.yml` | PR (path-filtered) | Matrix: backend-unit, backend-integration, frontend-unit, frontend-integration. Coverage uploaded. |
| `.github/workflows/regression-guard.yml` | PR with `bug` label | Blocks merge if no test added under `tests/` |
| `.github/workflows/release-e2e.yml` | Reusable / manual | Runs `e2e/test:full` against a deployed URL; gates production deploys |
| `.github/workflows/nightly-staging-e2e.yml` | Cron + manual | Runs `e2e/test:full` against staging every night |

---

## What goes where (decision shortcut)

> "I want to test that a function returns X for input Y."
→ **Unit** test, in `tests/unit/` mirroring the source path.

> "I want to test that POST /resource returns 201 and writes to DB."
→ **Backend integration** test in `backend/tests/integration/<module>/`.

> "I want to test that this React component handles a loading → success transition."
→ **Frontend integration** test in `frontend/tests/integration/`.

> "I want to test that a logged-in user can launch a course in their browser."
→ **E2E** test in `e2e/tests/smoke/` (if it must run on every PR) or `e2e/tests/full/`.

> "I just fixed a bug. Where do I add the regression test?"
→ The same layer that *would have* caught it. Most often a **unit** test. If only browser-level reproduction is reliable, an `e2e/tests/regression/` spec.

---

## Authoring rules (short)

1. One source file, one test file (mirrored path).
2. One `describe` block per exported symbol; one `it` per branch.
3. Mock at the module boundary; never mock the function under test.
4. Exercise public surface only — don't poke at private methods.
5. Tests must be **independent** (random order, no fixture leakage).
6. Flaky test = bug in the test. Fix or delete; never `retry`.
7. Don't snapshot UI; assert on accessible queries (`getByRole`, `findByText`).
8. Don't add tests just to inflate coverage. Each `it` should fail on a real regression.
