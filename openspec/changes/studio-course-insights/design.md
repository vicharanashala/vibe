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
- Figures are live: updated as events happen, with no scheduled job and no extra infrastructure.
- Existing courses are built gradually on first view, within ordinary requests, with bounded time and memory per request.
- No change to what learning records contain. Analytics hooks run after the student's save and can never fail it.

**Non-Goals:**
- Cross-course or platform-wide analytics. The model is per course version, but nothing here prevents adding those later.
- Per-cohort filtering of the dashboard. It's an obvious next step, and cohort is stored on read-model rows so it can be added without a rebuild.
- Changing the existing `/statistics` endpoint or `courseVersionStats`.

## Decisions

### 1. Event-driven per-learner recompute, no scheduled job
The read models are updated when events happen. The user ruled out a Cloud Run Job and scheduler (17 Nov).

A batch projector every 5 minutes was the first version. It was dropped for two reasons:
- It needs a separate job: serving instances are CPU-throttled and have 512 MiB, and a full backfill peaked at 714 MiB.
- It re-reads every active student's activity on every run.

**Events recompute one learner and apply a difference.** An event doesn't `$inc` a counter blindly. It recomputes **that one learner's** tier-1 and tier-2 rows from their own records, which is a handful of indexed reads using the existing projection functions. Then it applies the difference between the learner's old and new rows to the course counters. This gives three properties:
- **Retries are free:** a repeated event recomputes the same rows, the difference is zero, and nothing is counted twice (spec: "Each event counted once").
- **Concurrent events stay correct.** Each replace is a single `findOneAndReplace`, guarded so it only replaces a row with an older `computedAt`. Each difference is taken against the row it actually replaced, so the course counters always equal the sum of the learner rows.
- **One code path:** the projection functions used for building and for events are the same, so they can't disagree.

**Where hooks fire:**

| Event | Source |
|---|---|
| Quiz submitted | `AttemptService` submit |
| Lesson finished, current lesson changed, course finished | `ProgressService.stopItem`, skip, the quiz-outcome paths and admin advance |
| Enrolled or unenrolled | `EnrollmentService` |
| Incident | `AnomalyService.recordAnomaly` |
| Study view | `StudyViewRepository` write |
| Rewind | `UserActivityEvent` upsert |

**How hooks are called:**
- **Always after the transaction commits.** The call is `void analyticsEvents.learnerChanged(versionId, userId).catch(log)`.
- **Never awaited** by the student's response, and errors are swallowed (spec: "Learning flows are never affected").
- **Skipped when not needed:** the hook does nothing if the course version has no analytics yet, or if the learner hasn't been reached by an in-progress build.
- **Debounced:** several events for the same learner within 2 s collapse into one recompute, kept in memory per instance. If an instance dies, the next event or a rebuild catches up.

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

### 3. Gradual first build during overview requests
`ca_state`, one row per version, holds:
- `status`: `none`, `building` or `ready`
- `cursorUserId`, `done`, `total`
- `startedAt`
- a lease (`leaseOwner`, `leaseUntil`)

An overview request runs these steps:
1. **No analytics yet** (`status` is `none`): create the state as `building`, with `total` = roster size and an empty cursor.
2. **Building:** try to take the lease with `findOneAndUpdate` where `leaseUntil < now`. If it's acquired, run **one step**:
   1. read the next roster learners after `cursorUserId`, ordered by `userId`
   2. recompute each through the same per-learner function the events use
   3. stop at 500 learners or 3 seconds, whichever comes first
   4. advance the cursor
   5. release the lease

   Then reply `{status:'building', buildProgress}`. If the lease is held by another tab or instance, reply with the current progress without doing work.
3. **After the last learner:** compute the tier-3 rows for the version once from the tier-1 and tier-2 rows, set `status:'ready'`, and reply with the full overview.

Why this design:
- **CPU:** every step runs inside a request, so Cloud Run gives it full CPU. Nothing depends on background CPU after the response.
- **Memory:** bounded to one batch of learners.
- **Leaving and returning:** a closed tab just pauses the build at its cursor.
- **Events during a build:**
  - a learner at or before the cursor is recomputed by the event hook
  - a learner after the cursor is skipped, because the build will read their up-to-date records when it gets there

  So each event lands exactly once (spec: "Events during the build").

**Rebuild (admin):** deletes the version's `ca_*` rows and resets the state to `building`. The next overview requests rebuild it the same way.

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

### 5. Time-based figures at read time
Inactivity, time on the current lesson, medians (days to finish, time on a lesson), progress bands, the funnel, "where students are now" and "students to check on" change with time or roster state, not only with events. The overview computes them on each request from `ca_learners`:
- one indexed query on `versionId`
- a small projection of about 10 fields

That's about 10,000 short rows for the largest course, the same order as the existing roster reads. The result is cached in memory per instance for 30 s.

Counter-style figures are kept up to date by events and read directly:
- daily activity
- the heatmap
- per-item quiz and video stats
- proctoring by day

**Removed from the earlier version:**
- the 5-minute refresh
- the nightly rebuild
- the Cloud Run Job entrypoint
- the node-cron fallback and `ENABLE_ANALYTICS_PROJECTOR_JOB`
- the watermark and dirty-learner detection

### 6. Read API
`GET /analytics/courses/:courseId/versions/:versionId/overview?range=7|30|90` returns one JSON payload with these sections:
- `status`: `ready` or `building`
- `buildProgress`: 0–100, present while building
- `updatedAt`: response time
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

The response shape is fixed so the backend and v3 PRs can be built in parallel:

```ts
type Range = 7 | 30 | 90;
interface Metric { current: number | null; previous: number | null } // null = no data for that period
interface CourseInsights {
  status: 'ready' | 'building';
  buildProgress?: number;              // 0–100, only while building
  updatedAt: string | null;            // ISO; when the figures were read
  range: Range;
  // Everything below is omitted when status === 'building'.
  headline?: {
    students: Metric; activeThisWeek: Metric; averageProgress: Metric; // averageProgress in %, 0–100
    finished: Metric; medianDaysToFinish: Metric; learningHours: Metric;
  };
  daily?: { day: string /* YYYY-MM-DD IST */; activeLearners: number; learningHours: number; newEnrolments: number }[];
  heatmap?: number[][];                // [weekday 0=Mon..6=Sun][hour 0..23] learning hours, IST
  progressBands?: { band: '0' | '1-24' | '25-49' | '50-74' | '75-99' | 'finished'; students: number }[];
  funnel?: { moduleId: string; name: string; reached: number; completed: number }[];
  whereNow?: { itemId: string; moduleId: string; sectionId: string; name: string; type: string; students: number; medianDaysThere: number }[];
  quizzes?: {
    itemId: string; moduleId: string; sectionId: string; name: string;
    attempted: number; firstAttemptPassRate: number | null; // 0–1
    avgAttemptsToPass: number | null;
    scoreBands: number[];              // 10 bands: 0–9, 10–19, … 90–100 (% score of first attempt)
    hardestQuestions: { questionId: string; text: string; correctRate: number /* 0–1 */; answered: number }[];
  }[];
  videos?: {
    itemId: string; moduleId: string; sectionId: string; name: string;
    started: number; completed: number;
    rewindHotspots: { startSecond: number; rewinds: number }[]; // 10-second segments, top 5
  }[];
  checkOn?: {
    userId: string; name: string; email: string;
    reason: 'inactive' | 'stuck'; daysSinceActive: number;
    item: { itemId: string; name: string } | null; daysOnItem: number | null;
  }[];
  proctoring?: {
    checksOn: boolean;
    daily: { day: string; per100Hours: Partial<Record<string, number>> }[]; // keyed by anomaly type
    shareWithIncident: number;          // 0–1
  };
  studyMode?: { strictOnly: number; studyOnly: number; both: number };
}
```

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

- **[Hooks add work to student write paths]**
  - **What they do:** each recompute is about 6 indexed reads and 3 small writes for one learner.
  - **Mitigations:**
    - it runs after commit and is never awaited, so it doesn't delay the response
    - it's debounced per learner
    - it's skipped for course versions without analytics
    - errors are swallowed
  - **Tests:** a test asserts that a hook that throws still lets submit and stop succeed.
- **[A hook missed]** (instance killed mid-recompute, or a write path not yet hooked, such as an admin script) → That learner's rows are stale until their next event. The admin rebuild is the repair tool. A missing hook is a code bug, caught by tests that exercise each write path.
- **[First view of a big course takes a while]** → About 20 build steps for 10,000 students, at a few seconds each, with a progress bar. It only happens once per course. Teachers can leave and come back.
- **[Read-time figures cost one `ca_learners` query per request]** → It's indexed and projected, with a 30 s per-instance cache. The load check covers 10,000 students.
- **[`anomaly_records` and `user_activity_events` indexes]** → The read-side indexes from task 1.3 stay, for per-learner recomputes.
- **[Recharts bundle size]** → It's lazy-loaded, as before.

## Migration Plan

1. **Backend PR:**
   - Merge and deploy.
   - New collections and indexes are created on start-up.
   - No infrastructure is needed.
2. **v3 PR:** merge and deploy.
3. **First view of each course:** the first time a teacher opens a course's Overview, its analytics build over a few requests, with a progress bar. After that, they stay live.
4. **Rollback:**
   - Revert the backend PR.
   - Hooks are fire-and-forget, so removing them can't affect students.
   - Dropping the `ca_*` collections is safe, because nothing else reads them.
