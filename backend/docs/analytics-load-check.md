# Analytics load check (task 5.4, redone after the event-driven rework)

**Setup** (17 Nov 2026):
- **Backend:** the built backend (`node build/index.js`) on :4005, started with `NODE_OPTIONS=--max-old-space-size=384` to mimic the 512 MiB Cloud Run instance.
- **Database:** a local single-node MongoDB 7 replica set, with the production indexes on the source collections.
- **Auth:** the Firebase Auth emulator issues the token.
- **Interference:** the machine was shared with other work; one run during a load-average spike (130+) was discarded.

**Fixture:**
- one course version with **10,000 students**, 5 modules × 8 items (30 videos, 10 quizzes)
- 179,239 viewing sessions
- 40,740 quiz results
- 9,551 proctoring incidents
- plus two small courses

## First view: gradual build

The overview of the 10,000-student course was requested repeatedly from an empty state, as the Studio page's polling does.

| | Result | Target |
|---|---|---|
| Build steps | 28 steps of up to 3 s of work plus overhead | — |
| Step duration | p50 3.3 s, p95 3.8 s, max 3.9 s | under 5 s |
| Server memory (RSS), idle before the build | 317 MiB | — |
| Server memory (RSS), peak during the build | 370 MiB (+53 MiB) | well under 512 MiB |
| Server memory (RSS), after the measurements below | 381 MiB | — |

## Ready overview

`GET /api/analytics/courses/:c/versions/:v/overview` was sent 50 times sequentially per range, after one warm-up.

- **Cached** means nothing changed since the last request, so the 30 s per-instance cache answers.
- **Uncached** means `ca_state.changeSeq` was bumped before each request. That forces the full read-time computation: per-learner figures from 10,000 learner rows, counters, sweep and roster check.

| Range | Cached p50 / p95 | Uncached p50 / p95 / max | Response |
|---|---|---|---|
| 7 days | 43 / 62 ms | 347 / 386 / 443 ms | 28.7 KB |
| 30 days | 40 / 51 ms | 361 / 419 / 450 ms | 32.0 KB |
| 90 days | 37 / 45 ms | 334 / 442 / 496 ms | 40.3 KB |

The target was p95 under 1 s.

## Events

These were measured in-process against the same database, for 50 learners of the 10,000-student course.

| | p50 | p95 | max | Target |
|---|---|---|---|---|
| Added to the student's request (the `notifyLearnerChanged` call; the rest runs after it returns) | 0.002 ms | 0.012 ms | 0.17 ms | under 10 ms |
| Background recompute of one learner plus its counter update | 40 ms | 55 ms | 82 ms | — |

The background figure needs the per-learner read indexes that the analytics repository creates. With only the pre-existing course-version index on `enrollment`, every event scanned the version's whole roster, and a recompute took about 290 ms.
