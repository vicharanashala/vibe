# Analytics load check (task 5.4)

Local stack, 17 Nov 2026: built backend (`node build/index.js`) on :4005
against a local single-node MongoDB 7 replica set with the production indexes
on the source collections; Firebase Auth emulator for the token.

Fixture: one course version with **10,000 students**, 5 modules × 8 items
(30 videos, 10 quizzes), 179,239 viewing sessions, 40,740 quiz results,
9,551 proctoring incidents (+ two small courses).

**Overview endpoint**, 50 sequential requests per range after one warm-up
(`GET /api/analytics/courses/:c/versions/:v/overview`):

| Range | p50 | p95 | max | Response |
|---|---|---|---|---|
| 7 days | 68 ms | 112 ms | 119 ms | 28.8 KB |
| 30 days | 54 ms | 69 ms | 103 ms | 32.1 KB |
| 90 days | 53 ms | 70 ms | 112 ms | 40.3 KB |

Target was p95 < 1 s.

**Projector** (`node build/jobs/analyticsProjector.js`):
- `backfill` of all three versions: 21.9 s wall clock, 714 MiB peak RSS
  (the 10,000-student version is ~19 s of that).
- `refresh` after 200 new viewings in the large course: 10.5 s wall clock
  including ~3 s start-up, 315 MiB peak RSS; the two quiet versions skipped.
