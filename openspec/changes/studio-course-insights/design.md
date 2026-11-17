# Design

## Context

See proposal.md for the motivation and specs/ for the required behaviour.

**What the Overview tab shows today.** `CourseOverview` in `v3/.../admin/course-detail-page.tsx` reads one endpoint, `GET /users/enrollments/courses/:c/versions/:v/statistics`. Three of its figures are counted live from `enrollment`. The fourth, watch hours, comes from `courseVersionStats`, a precomputed collection filled every 15 minutes by `bootstrap/jobs/refreshEnrollmentStats.ts` (node-cron, in process). That is the only read model in the codebase, and the pattern this change generalises.

**Production constraints, observed on 17 Nov:**
- **CPU and memory:** `vibe-backend-production` runs on Cloud Run with `cpu-throttling: true` and 512 MiB of memory. An instance with no request in flight gets almost no CPU, so in-process cron is best-effort. A memory-heavy batch on the serving instance risks the kind of out-of-memory outage seen on 3 Nov.
- **Student path is fragile:** progress and quiz flows are in active repair (#1518, #1533, #1534). Analytics must not add work or risk to `startItem`, `stopItem`, quiz submission or watch-time heartbeats.

**How the source data can be read incrementally:**

| Source | What's indexed / available |
|---|---|
| `watchTime` | Indexed by `{courseId, courseVersionId, endTime}`; viewings are closed on stop or by the orphan-recovery job |
| `quiz_submission_results` | Indexed by `{quizId, gradingStatus, submittedAt}`; each result carries per-question `overallFeedback[].status` |
| `anomaly_records` | Has `createdAt` |
| `user_activity_events` | Has `updatedAt`; each rewind carries `createdAt` |
| `studyViews` | Has `firstStudiedAt` |
| `enrollment` and `progress` | No change timestamps, but both are per-version and small enough to read whole for one version |

## Goals / Non-Goals

**Goals:**
- Overview endpoint answers with indexed reads of precomputed documents only: no `$lookup` and no scans of raw collections at request time.
- Figures are at most about 10 minutes behind, exact after the nightly rebuild, and safe to recompute at any time.
- Zero changes to how learning records are written.

**Non-Goals:**
- Real-time (second-level) dashboards.
- Cross-course or platform-wide analytics. The model is per course version, but nothing here prevents adding those later.
- Per-cohort filtering of the dashboard. It's an obvious next step, and cohort is stored on read-model rows so it can be added without a rebuild.
- Changing the existing `/statistics` endpoint or `courseVersionStats`.

## Decisions

### 1. Batch projector over existing records, not events in the write path
The read models are rebuilt from the source collections by a background projector.

The alternative considered was emitting domain events from `ProgressService` and `AttemptService` and updating counters synchronously, or using MongoDB change streams. It was rejected:
- **Synchronous events** put extra writes and new failure modes into the exact code paths that broke this week.
- **Change streams** need a long-lived consumer, which scale-to-zero, CPU-throttled Cloud Run doesn't give us.

A batch projector reads only, can be re-run safely, and is easy to test against fixtures.

### 2. Three tiers of read models, all per course version (prefix `ca_`)

**Tier 1, per learner**, recomputed only for "dirty" learners:
- **`ca_learners`**: one row per `{versionId, userId}`, holding:
  - `enrolledAt`, `cohort`
  - `percent`, `completedAt`
  - `lastActiveAt`
  - `currentItemId` and `currentItemSince`
  - `furthestModuleIndex`, `completedModuleIds`
  - `usedStrict`, `usedStudy`
  - `incidentCount`
  - `excluded`, set for staff, guests and quick-share holders
- **`ca_learner_quizzes`**: one row per `{versionId, userId, quizId}`, holding:
  - `attempts`
  - `firstAttemptPassed`, `attemptsToPass`
  - `firstAttemptScorePct`, `bestScorePct`
  - the first attempt's per-question results
- **`ca_learner_videos`**: one row per `{versionId, userId, itemId}`, holding `started`, `completed`, and rewind counts per 10-second segment.

**Tier 2, per learner per day:**
- **`ca_learner_days`**: one row per `{versionId, userId, day (IST)}`, holding `learningSeconds`, `secondsByHour[24]`, `incidentsByType` and `enrolled`.

  This row is what makes "distinct active students per day" a plain count instead of a set computation.

**Tier 3, course summaries**, the only collections the endpoint reads:
- **`ca_course_daily`**: one row per `{versionId, day}`, holding `activeLearners`, `learningSeconds`, `newEnrolments` and `incidentsByType`.
- **`ca_course_heatmap`**: one row per `{versionId, day}`, holding `secondsByWeekdayHour`.

  It is day-bucketed so that any 7/30/90-day range is a sum over at most 90 small rows.
- **`ca_course_snapshot`**: one row per version, holding:
  - headline metrics for the 7, 30 and 90-day ranges and the previous period of each
  - progress bands
  - module funnel
  - "where students are now"
  - students to check on (top 50)
  - study-mode split
  - median days to finish
- **`ca_item_stats`**: one row per `{versionId, itemId}`:
  - **for quizzes:** students attempted, first-attempt pass rate, average attempts to pass, score bands, hardest questions
  - **for videos:** started, completed, top rewind segments

Tier 3 is aggregated from tiers 1 and 2 after each refresh. Those collections are compact (one row per learner, or per learner-day) and indexed by `versionId`, so aggregating them is cheap and stays off the request path.

Alternative considered: a single document per course. It was rejected because a 10,000-student roster plus per-day series would push past MongoDB's 16 MB document limit and make every update rewrite the whole thing.

### 3. Dirty-learner detection with a per-version watermark
`ca_state`, one row per version, stores:
- `watermark`: the time source records were read up to
- `lastRefreshedAt`
- `firstBuildCompletedAt`
- `status`
- a lease (`leaseOwner`, `leaseUntil`)

A refresh runs these steps:
1. Take the lease atomically. The lease document is updated with `findOneAndUpdate` only where `leaseUntil < now`, so only one instance proceeds (spec: "Single refresher").
2. Set `upTo = now − 2 min`. The margin is for writes still in flight.
3. Collect the dirty user IDs, meaning learners with any of these between `watermark` and `upTo`:
   - `watchTime.endTime`
   - `quiz_submission_results.submittedAt`, read per quiz in the version
   - `anomaly_records.createdAt`
   - `studyViews.firstStudiedAt`
   - `user_activity_events.updatedAt`
4. Read the whole roster from `enrollment` and `progress` for the version, with a projection to keep it small:
   - learners whose `currentItem` or `percentCompleted` changed since the stored tier-1 row are dirty too
   - new enrolments are dirty
   - removed or unenrolled learners are deleted
5. For each dirty learner, recompute tiers 1 and 2 from their own records (indexed by user and version), and replace their rows.
6. Re-aggregate tier 3 for the version.
7. Advance `watermark = upTo` and release the lease.

Each step replaces rows rather than incrementing them. So a crash between steps loses nothing: the watermark hasn't moved, and the next run recomputes the same learners (spec: "Refresh resumes after a failure").

### 4. Derived values and their rules
- **Learning time:**
  - **How a viewing is measured:** `endTime − startTime` for closed viewings, capped at 3 × the video's length (or 3 h for non-video items), so an abandoned tab doesn't add hours.
  - **How it's attributed:** split across the IST hours and days it covers.
  - **Open viewings:** counted once they close, either on stop or by orphan recovery.
- **`currentItemSince`:**
  - **When it's set:** when a refresh sees `currentItem` change, it becomes the latest activity time from the dirty records, or `upTo` if there's no activity.
  - **First build:** it's the learner's last activity.
  - **Accuracy:** about ±1 refresh interval, which is enough for "stuck for days".
- **Quizzes:**
  - **Order:** attempts are ordered by `submittedAt`.
  - **"Attempts to pass"** is the position of the first passing attempt.
  - **"Correct share" per question:** each learner's first attempt, `status == CORRECT`, over the learners who saw that question.
- **Funnel:**
  - **"Reached" a module:** the learner's furthest position is at or beyond the module's first visible item.
  - **"Completed" a module:** every visible item of the module is in the learner's completed items, as defined by the existing completion rules.
  - **Course order:** follows the version's module, section and item order, ignoring hidden and deleted entries.
- **Students to check on:**
  - unfinished learners with `lastActiveAt` ≤ now − 7 d
  - learners with `currentItemSince` ≤ now − 3 d
  - sorted by time since last active, top 50 stored
- **Exclusions:** the same filter as the existing statistics.
  - Roles other than `STUDENT` are excluded.
  - So are `isShareLinkGuest` and `isQuickShareContainer`.

### 5. Where the projector runs
`modules/analytics/services/AnalyticsProjector` exposes `refreshVersion(versionId)`, `rebuildVersion(versionId)` and `refreshAllActive()`. Three entry points use it:
- **Production, recommended:** a Cloud Run **Job** running the same backend image with entrypoint `node build/jobs/analyticsProjector.js`.
  - **Schedule:** Cloud Scheduler triggers it every 5 minutes (`refresh`) and nightly at 02:30 IST (`rebuild`).
  - **Memory:** the job gets 1–2 GiB of memory and full CPU.
  - **Effect on students:** none, because it runs separately from serving traffic.
- **Fallback:** an in-process node-cron job in `bootstrap/jobs/analyticsProjector.ts`, gated by `ENABLE_ANALYTICS_PROJECTOR_JOB`.
  - **Default:** off in production and on in local/dev.
  - **Purpose:** the feature still works without the Cloud Run Job, and the local stack can be tested.
- **On demand:** `POST /analytics/courses/:c/versions/:v/rebuild`, admin only, runs `rebuildVersion` asynchronously and records completion in `ca_state`.

The first deploy backfills by running `rebuild` for every version with active enrolments. Until a version's first build completes, the endpoint returns `{status: 'building'}` (spec: "Backfill on first deploy").

Alternative considered: only node-cron, as `refreshEnrollmentStats` does today. That is simpler, but CPU throttling makes it fire unpredictably, and a full rebuild on a 512 MiB serving instance is an out-of-memory risk.

### 6. Read API
`GET /analytics/courses/:courseId/versions/:versionId/overview?range=7|30|90` returns one JSON payload with these sections:
- `status`
- `updatedAt`
- `headline` (current and previous values)
- `daily[]`
- `heatmap[7][24]`
- `progressBands`
- `funnel[]`
- `whereNow[]`
- `quizzes[]`
- `videos[]`
- `checkOn[]`
- `proctoring`
- `studyMode`

How it's served:
- **Reads:** at most five queries, all indexed by `versionId` (snapshot, item stats, and range slices of daily and heatmap).
- **Access:** authorised with the same ability check as the existing `/statistics` endpoint.
- **API types:** documented with routing-controllers-openapi so the v3 types can be regenerated.

Quiz question text and lesson names are joined from the course structure, which is already cached per version, so read models store IDs only.

### 7. v3 presentation
- **Data fetching:**
  - `features/admin/insights/queries.ts` adds `useCourseInsights(courseId, versionId, range)`, with `staleTime` set to 5 minutes.
  - `range` lives in the course route's search params (`?range=7`), next to the existing `tab`.
- **Charts:** the shadcn `chart` component (Recharts under shadcn's `ChartContainer`, `ChartTooltip` and `ChartLegend`). It's added through the shadcn CLI, per the "shadcn only" rule.
  - The heatmap is a CSS grid of shadcn `Tooltip` cells. Recharts has no heatmap.
  - The funnel is a horizontal bar chart with the largest drop annotated.
  - Each chart has a title, an `aria-describedby` summary sentence, and a hidden data table for screen readers.
- **Layout:** sections in the order of the proposal.
  - **Range control:** a `ToggleGroup` selects the range.
  - **Headline cards:** extend the existing `StatStrip` with a trend badge.
  - **Lists:** "Where students are now" and "Students to check on" use `Table`.
  - **Details:** quiz and video detail open in a `Sheet`.
- **Links:**
  - "Open lesson" uses the existing lesson-editor route.
  - "Open student" goes to `?tab=people&q=<email>`. The People tab's search box today is local state, so this change moves it into a `q` search param.

## Risks / Trade-offs

- **The dirty-learner pass reads the whole roster from `enrollment` and `progress` every 5 minutes, per active version.**
  - **Cost:** tens of thousands of small documents per run across all courses.
  - **Mitigations:**
    - a projection limited to the fields compared
    - versions processed one at a time
    - versions with no source activity since the watermark skipped, unless the nightly rebuild is due
- **Progress changes that leave no timestamped trace** (for example an admin advancing a student) **are only noticed by the roster comparison.** Figures could briefly disagree. → The roster comparison catches `currentItem` and `percentCompleted` changes, and the nightly rebuild corrects anything else.
- **Learning time from closed viewings only, so an in-progress viewing appears late.** → Acceptable for a dashboard updated every few minutes. The orphan-recovery job closes abandoned viewings.
- **`anomaly_records` and `user_activity_events` may lack indexes for "this version, since T".** → This change adds `{versionId, createdAt}` and `{courseVersionId, updatedAt}` indexes (built in the background). Those are read-side indexes only; how records are written doesn't change.
- **Recharts adds bundle size.** → The Overview insights are lazy-loaded with the route's code-split boundary, so students never download it.
- **Cloud Scheduler and the Cloud Run Job are infrastructure the user must create.** → The node-cron fallback keeps the feature working until they exist. The migration plan lists the exact resources.

## Migration Plan

1. **Backend PR:**
   - Merge and deploy as usual.
   - New collections and indexes are created on start-up.
   - With `ENABLE_ANALYTICS_PROJECTOR_JOB` unset in production, nothing runs yet.
2. **Create infrastructure** (done by the user):
   - **Cloud Run Job `vibe-analytics-projector`:**
     - same image as the backend
     - entrypoint `node build/jobs/analyticsProjector.js`
     - 2 GiB of memory, 1 CPU
     - same environment and secrets as the backend
   - **Cloud Scheduler triggers:** `*/5 * * * *` with arg `refresh`, and `30 2 * * *` (Asia/Kolkata) with arg `rebuild`.
3. **Run the job once by hand with `backfill`** to build every active version, then check one course's figures against direct database counts.
4. **v3 PR:** merge and deploy. Until the backend is live, the Overview shows its existing content plus the "being prepared" message.
5. **Rollback:**
   - Pause the scheduler.
   - The Overview falls back to the "being prepared" state.
   - Dropping the `ca_*` collections is safe, because nothing else reads them.

## Open Questions

- **Exact refresh cadence (5 vs 10 minutes)** depends on Cloud Run Job cost and run time on the largest course. Measure after the backfill. The spec allows up to 10 minutes.
