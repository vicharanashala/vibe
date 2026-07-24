# Integrations API

Server-to-server endpoints in `IntegrationController.ts` for external
applications that need to pull learner/completion data out of ViBe. These are
**not** for logged-in learners — they authenticate the *calling application*
via a shared secret, not a per-user Firebase token.

## Authentication

Every request must include:

```
X-API-Key: <shared secret>
```

The secret is configured via the `INTEGRATION_API_KEY` environment variable
per environment (local `.env`, staging, production — each gets its own
value). If the server has no key configured, every request is rejected
(fail-closed). Requests with a missing or wrong key get `401 Unauthorized`.

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
