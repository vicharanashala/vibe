# peerReview module

This is the v1 peer-based review system for ViBe.

See the [module convention doc](../../../../../docs/docs/contributing/conventions/peer-review.mdx)
for the full design and contributor guide.

## Quick start

The module is auto-discovered by the backend's `loadAppModules` —
no manual wiring needed. The 3 crons register via
`backend/src/bootstrap/jobs/peerReviewCrons.ts`.

## Tests

```bash
cd backend
pnpm --filter backend exec vitest run modules/peerReview/tests/
```

69/69 unit tests pass (pure-function tests, no DB required).
DB-backed integration tests are blocked on the project-wide
test-infra issue (MongoMemoryServer TLS handshake).

## e2e

```bash
cd e2e
pnpm exec playwright test peer-review.spec.ts
```

Requires the test env vars documented in
`e2e/tests/peer-review.spec.ts`.

## Public API

- `POST /peer-review-assessments` (teacher)
- `PATCH /peer-review-assessments/:id` (teacher)
- `GET /peer-review-assessments/:id` (teacher + student)
- `POST /peer-review-assessments/:id/close` (teacher)
- `POST /courses/:cId/versions/:vId/items/:itemId/submit` (student)
- `GET /students/me/submissions?assessmentId=...` (student)
- `GET /students/me/peer-review-assignments` (reviewer)
- `GET /peer-review-assignments/:id/submission` (reviewer)
- `POST /peer-review-assignments/:id/review` (reviewer)
- `GET /students/me/peer-reviews-received?assessmentId=...` (submitter)
- `GET /peer-review-assessments/:id/submissions` (teacher only)
- `GET /peer-review-assessments/:id/reviews` (teacher only)
- `PATCH /peer-reviews/:id/teacher-override` (teacher only)

## Double-blind gatekeeper

`utils/doubleBlindFilters.ts` defines the allow-lists. The 18
unit tests in `tests/doubleBlindLeak.test.ts` are the v1
gatekeeper — if any of them fails, the build fails.
