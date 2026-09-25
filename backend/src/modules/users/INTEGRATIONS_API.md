# Integrations API

Server-to-server endpoints — `IntegrationController.ts` (learner/completion
data pulls) and `JobsController.ts` (on-demand job triggers) — for external
callers that aren't a logged-in learner. They authenticate the *calling
application* via a shared secret, not a per-user Firebase token.

## Authentication

Every request must include:

```
X-API-Key: <shared secret>
```

Preferred: give each consumer (Cloud Scheduler, a partner integration, ...)
its own named secret via `INTEGRATION_API_KEYS`, a comma-separated
`name:key` list, e.g.:

```
INTEGRATION_API_KEYS=cloud-scheduler:a1b2c3...,acme-lms:d4e5f6...
```

A named key can be revoked on its own by deleting its entry, without
rotating everyone else's. The legacy `INTEGRATION_API_KEY` (a single shared
secret, attributed as `legacy` in logs) still works for back-compat but
shouldn't be used for new consumers. If neither is configured, every request
is rejected (fail-closed). Requests with a missing or wrong key get
`401 Unauthorized`. Each request's consumer name and route are logged
server-side (`[integration] consumer=... METHOD /path`); the key itself
never is.

## `GET /integrations/courses/:courseId/completions`

Returns candidates who have completed one specific course: an active
`STUDENT` enrollment on that course with a matching `progress` record where
`completed: true`.

**Path param**

| Name | Type | Description |
|---|---|---|
| `courseId` | Mongo ObjectId string | The course to query. Invalid format → `400`. |

**Query params**

| Name | Default | Notes |
|---|---|---|
| `page` | `1` | 1-indexed. |
| `limit` | `50` | Clamped to a max of `200`. |

**Response `200`**

```json
{
  "page": 1,
  "limit": 50,
  "totalCandidates": 2,
  "totalPages": 1,
  "candidates": [
    {
      "userId": "6a...",
      "email": "learner@example.com",
      "name": "Learner Name",
      "courseVersionId": "6a...",
      "completedAt": "2026-02-01T00:00:00.000Z"
    }
  ]
}
```

Candidates are sorted by `completedAt` ascending (earliest finisher first).
A learner whose enrollment is no longer `ACTIVE` (unenrolled/ejected after
completing) is excluded, even if their `progress.completed` is still `true`.

**Example**

```bash
curl -H "X-API-Key: $INTEGRATION_API_KEY" \
  "https://<host>/api/integrations/courses/<courseId>/completions?page=1&limit=50"
```

## `GET /integrations/learners/completions`

Platform-wide roster: every active `STUDENT` learner, each with the full list
of courses they've completed. Paginated by *learner*, not by completion —
prefer the course-scoped endpoint above when you only care about one course.

**Query params:** `page` (default `1`), `limit` (default `50`, max `200`).

See the controller's `@OpenAPI` annotations (also served live at `/reference`)
for its full response shape.

## `POST /jobs/recover-orphaned-watchtimes`

Runs the orphaned watch-time recovery sweep on demand — the same logic as
the every-30-minutes in-process cron job. node-cron is just a JS timer, so
on Cloud Run (which can scale to zero or throttle CPU between requests) it
can silently miss ticks with no retry. Point Cloud Scheduler at this
endpoint instead of relying solely on the in-process timer.

**Query params:** `olderThanMinutes` (default `30`), `batchSize` (default
`500`).

**Response `200`:** `{ scanned, closed, advanced, rejected, skipped }` —
counts from the sweep, so ops can confirm a run actually recovered
something. Also logged server-side on every trigger (consumer, params, and
result), so `grep "[jobs] recoverOrphanedWatchTimes"` in Cloud Run logs
answers "did Cloud Scheduler actually fire?" without touching the database.

Safe to call repeatedly or concurrently: each orphaned record is closed via
an atomic, guarded update, so a record already closed by one run is simply
skipped by another, not double-counted.

Rate-limited to 20 requests / 5 minutes per caller — enough headroom for
any reasonable Cloud Scheduler frequency, low enough to cap the damage from
a misconfigured scheduler hammering the endpoint.

### Configuring Cloud Scheduler

1. Give this consumer its own entry in `INTEGRATION_API_KEYS`, e.g.
   `cloud-scheduler:<generate a long random secret>`.
2. Create the Cloud Scheduler job with:
   - Target: HTTP, `POST https://<backend host>/jobs/recover-orphaned-watchtimes`
   - Header: `X-API-Key: <the secret from step 1>`
   - Frequency: e.g. every 30 minutes (`*/30 * * * *`), matching the
     original cron schedule — adjust to taste, the endpoint doesn't care how
     often it's called beyond the rate limit above.
3. Redeploy so the new `INTEGRATION_API_KEYS` value takes effect, then run
   the job once manually from the Cloud Scheduler console to confirm it
   returns `200` and the log line above appears.
