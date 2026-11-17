# Tasks

**Checks to run:**
- **Backend** (from `backend/`):
  - `npx vitest run <files>`
  - `npx tsc --noEmit -p .`
  - `bash .github/scripts/check-backend-format.sh origin/main <out>` (run from the repo root)
- **v3** (from `v3/`):
  - `npx vitest run --root apps/student`
  - `npx tsc -b apps/student/tsconfig.app.json apps/student/tsconfig.spec.json`

**Release order:** the backend groups (1–5) land as one backend PR and are deployed first. The v3 groups (6–9) are a separate PR. **No infrastructure is needed:** there's no scheduled job, and analytics update on events and build on first view.

## 1. Backend: read-model storage

- [x] 1.1 Create `modules/analytics` (container, types, module registration). Define the `ca_*` document interfaces from design §2 and the `ca_state` interface (watermark, lastRefreshedAt, firstBuildCompletedAt, status, lease). Verify that `npx tsc --noEmit` passes and the module loads in the existing container bootstrap test.
- [x] 1.2 Add `AnalyticsRepository`:
  - collection getters
  - `{versionId, …}` indexes for every `ca_*` collection
  - replace-style writes per learner and per item
  - `acquireLease`/`releaseLease` using `findOneAndUpdate` where `leaseUntil < now`

  Verify with mongodb-memory-server tests: two concurrent `acquireLease` calls give exactly one winner, and an expired lease can be retaken.
- [x] 1.3 Add the read-side source indexes `anomaly_records {versionId, createdAt}` and `user_activity_events {courseVersionId, updatedAt}`, created in the background on start-up. Verify with a test that the indexes exist after `init()`, and check `git diff` to confirm no write-path code changed.

## 2. Backend: per-learner projection (tiers 1–2)

- [x] 2.1 Implement roster loading: enrollments of the version with the exclusion filter (non-STUDENT roles, `isShareLinkGuest`, `isQuickShareContainer`), joined with `progress` using a projection. Verify with a test where staff, a guest and a quick-share holder are excluded and an unenrolled learner's rows are deleted.
- [x] 2.2 Implement learning-time attribution:
  - closed `watchTime` viewings capped at 3× video length (3 h for non-video items)
  - split across IST hours and days into `ca_learner_days.secondsByHour`

  Verify with unit tests: a viewing crossing midnight IST, an over-long abandoned viewing being capped, and an open viewing being ignored.
- [x] 2.3 Implement the `ca_learners` fields:
  - `percent`, `completedAt`, `lastActiveAt`
  - `currentItemId`/`currentItemSince` (design §4)
  - `furthestModuleIndex` and `completedModuleIds`, using visible items in course order
  - `usedStrict`/`usedStudy`
  - `incidentCount`

  Verify with fixture tests: hidden/deleted items ignored, `currentItemSince` kept when the item is unchanged and reset when it changes.
- [x] 2.4 Implement `ca_learner_quizzes`: attempts ordered by `submittedAt`, `firstAttemptPassed`, `attemptsToPass`, first/best score %, and the first attempt's per-question status. Verify with tests: fail-then-pass gives 2 attempts to pass with first attempt not passed; a never-passed learner has no `attemptsToPass`.
- [x] 2.5 Implement `ca_learner_videos`: started/completed flags, and rewind counts per 10-second segment from `user_activity_events.rewindData[].to`. Verify with a test where rewinds to 4:12 and 4:18 both land in the 4:10 segment.
- [x] 2.6 Implement `ca_learner_days.incidentsByType` and `enrolled` from `anomaly_records` and `enrollmentDate`, bucketed by IST day. Verify with a test placing an incident at 23:50 IST on the correct day.

## 3. Backend: course summaries (tier 3) and the projector

- [x] 3.1 Implement the tier-3 aggregation from tiers 1–2, covering:
  - `ca_course_daily`: active learners as distinct learner-days, seconds, new enrolments, incidents
  - `ca_course_heatmap` by day
  - `ca_item_stats` for quizzes: pass rate, attempts to pass, 10-point score bands, 5 hardest questions
  - `ca_item_stats` for videos: started, completed, top segments
  - `ca_course_snapshot`: headline metrics for each range and its previous period, progress bands, funnel, where-now with median time, check-on top 50, study-mode split, median days to finish

  Verify each spec scenario in `specs/backend/course-analytics` as a unit test on fixture tier-1/2 rows, including that the bands add up to the roster and that a quiet day appears as zeros.
- [x] 3.2 Replace the batch refresh with `learnerChanged(versionId, userId)`:
  - recompute that learner's tier-1/2 rows with the existing projection functions
  - `findOneAndReplace` guarded by a newer `computedAt`
  - apply the old→new difference to the counter-style tier-3 rows (`ca_course_daily`, `ca_course_heatmap`, `ca_item_stats`)
  - skip when the version has no analytics, or when the learner is after an in-progress build's cursor

  Verify with mongodb-memory-server tests:
  - the same event processed twice changes nothing the second time
  - two concurrent recomputes leave the counters equal to the sum of the learner rows
  - a learner after the cursor is skipped
- [x] 3.3 Implement the gradual build in `ca_state` (`none`/`building`/`ready`, cursor, done/total, lease). One step processes up to 500 learners or 3 s, ordered by `userId`. The last step builds the tier-3 counters and sets `ready`. The admin rebuild deletes the version's rows and resets to `building`. Verify with tests:
  - repeated steps reach `ready` with figures identical to a single full build
  - an interrupted build resumes from the cursor
  - an event during a build is counted exactly once
  - two concurrent step attempts do one step
- [x] 3.4 Compute the read-time figures (progress bands, funnel, where-now with median time, check-on, study-mode split, median days to finish, headline counts) from `ca_learners` with one projected query, cached for 30 s per instance. Remove these from the stored snapshot. Verify with tests: a student with no events for 8 days appears as inactive for 8 days, and the existing tier-3 scenario tests still pass.
- [x] 3.5 Keep the guard test from the old task 3.4, extended: drive a build plus a series of events against a fixture database snapshot, then confirm the source collections are byte-identical before and after.

## 4. Backend: event hooks (after commit, fire-and-forget)

- [x] 4.1 Add `AnalyticsEvents` with a per-learner 2 s in-memory debounce. Hook it after commit into:
  - `AttemptService` quiz submit
  - `ProgressService` `stopItem`, skip, quiz-outcome and admin-advance paths
  - `EnrollmentService` enrol/unenrol
  - `AnomalyService.recordAnomaly`
  - study-view writes
  - rewind/activity upserts

  Each call is `void …catch(log)` and never awaited. Verify with tests for each hooked path:
  - the hook is called with the right version and user
  - a hook that throws still lets the student request succeed with an unchanged response
  - no hook runs for a version without analytics
- [x] 4.2 Remove the batch projector's scheduling and infrastructure: the `src/jobs/analyticsProjector.ts` entrypoint, `bootstrap/jobs/analyticsProjector.ts`, `ENABLE_ANALYTICS_PROJECTOR_JOB`, the watermark and dirty-learner detection, and `backend/docs/analytics-projector.md`. Update `backend/docs/analytics-load-check.md`. Verify that `tsc` passes, that grep finds no references to the removed names, and that the server still boots.

## 5. Backend: API

- [x] 5.1 Add `GET /analytics/courses/:courseId/versions/:versionId/overview?range=7|30|90`:
  - validators and an OpenAPI response schema matching design §6
  - reads only `ca_course_snapshot`, `ca_item_stats`, and range slices of `ca_course_daily`/`ca_course_heatmap`
  - names joined from the course structure
  - `status: 'building'` before the first build

  Verify with controller tests: 30-day shape, rejection of `range=14`, building state, and a query-count assertion of at most 5 database reads.

  **Rework:** while building, a request advances one build step and returns `{status:'building', buildProgress}` (design §3), and `updatedAt` is the response time. Verify with controller tests that repeated requests progress from 0 to 100 and then return the full payload.
- [x] 5.2 Authorise the overview with the same ability check as `/users/enrollments/.../statistics`. Verify with tests: an instructor of the course is allowed; a student and an instructor of another course are both refused with 403.
- [x] 5.3 Add `POST /analytics/courses/:courseId/versions/:versionId/rebuild` (admin only). It starts `rebuildVersion` in the background and returns 202. Verify with tests: admin gets 202 and `ca_state` later shows a new refresh time; a non-admin instructor is refused with 403.
- [x] 5.4 Load-check the overview against a generated 10,000-student fixture version. Verify that p95 is under 1 s across 50 sequential requests in the local stack, and record the timing in the PR.

  **Redo after the rework:** measure the ready-overview p95 with read-time figures (10,000 students), each build step's duration and peak memory (target under 5 s and well under 512 MiB), and the added latency of a quiz submit and a stop with hooks on (target under 10 ms, because hooks aren't awaited).
- [x] 5.5 Regenerate the v3 API types (`pnpm --filter @vibe/api generate` against the local backend). Verify that `npx tsc -b apps/student/tsconfig.app.json` passes in v3.

## 6. v3: data and page frame

- [ ] 6.1 Add the shadcn `chart` component through the shadcn CLI (it brings in Recharts), and code-split the insights section so student routes don't load it. Verify that the student course page bundle has no `recharts` chunk (`pnpm nx build student` and inspect the chunk list).
- [ ] 6.2 Add `features/admin/insights/queries.ts` with `useCourseInsights(courseId, versionId, range)` (`staleTime` 5 min). Add `range` (7/30/90, default 30) to the course route's search params. Verify with a spec that changing the range updates the URL and refetches with the new range.
- [ ] 6.3 Build the Overview frame:
  - range `ToggleGroup`
  - "Updated N minutes ago"
  - skeletons while loading
  - "being prepared" for `status: 'building'`
  - the no-students empty state
  - the existing finished students, action tiles, registration link and description kept

  Verify with specs for each state and that the registration link is still present.

- [ ] 6.4 Rework the building state: show "Preparing insights" with a percentage progress bar from `buildProgress`, poll every 3 s while building (each poll advances the build), drop the "Updated N minutes ago" label, and switch the insights query to the regenerated `@vibe/api` types. Verify with specs: 40% renders a 40% bar; polling stops and the figures render when the status turns `ready`.

## 7. v3: headline, activity and progress

- [ ] 7.1 Extend `StatStrip` with trend badges (up/down with delta, hidden when there's no previous data) for the six headline metrics. Verify with specs: Finished 12 vs 8 shows +4 up, and no badge appears without previous data.
- [ ] 7.2 Add the activity area chart (active students and hours), new-enrolments bars, and the weekday × hour heatmap built from shadcn `Tooltip` cells, all with titles, summary text and hidden data tables. Verify with specs: tooltip content on focus, heatmap cell value, screen-reader table present.
- [ ] 7.3 Add progress bands bar chart and module funnel with the largest drop highlighted and labelled; verify with specs (bands rendered from fixture, correct step highlighted with students lost).

## 8. v3: lessons, quizzes, videos and students

- [ ] 8.1 Add the "Where students are now" table, with a possible-blocker badge when there are ≥5 students and a median of ≥3 days, and a row action that opens the lesson editor. Verify with specs: the badge shows for the 15-students/4-days fixture, and selecting a row navigates to the lesson editor route.
- [ ] 8.2 Add the quiz list, sorted by lowest first-attempt pass rate, and a quiz detail `Sheet` showing the score distribution and up to 5 hardest questions with text and percent correct. Verify with specs for the sort order and the sheet content.
- [ ] 8.3 Add the video list with completion rate, and a video detail `Sheet` listing rewind hotspots as `m:ss` with counts. Verify with a spec where "4:10" is listed first.
- [ ] 8.4 Move the People tab's search into a `q` search param, then add the "Students to check on" table (name, reason, lesson, last active) that links to `?tab=people&q=<email>`, with an "everyone is active and moving" empty state. Verify with specs: selecting a student opens People filtered to them, and the empty state renders.

## 9. v3: proctoring, study mode, accessibility and integration

- [ ] 9.1 Add the proctoring chart (incidents per 100 hours by type), the share-with-incident figure, the "proctoring is off" state, and the study-mode split. Verify with specs for the chart data and the off state.
- [ ] 9.2 Check accessibility and responsiveness: every chart has a title and summary, tooltips are keyboard reachable, nothing relies on colour alone, light and dark themes work, and the layout is one column at 375px. Verify with specs that use keyboard focus to open tooltips, and with screenshots at 375px and 1280px in both themes attached to the PR.
- [ ] 9.3 End-to-end on the local stack:
  1. seed a course with students and activity
  2. run the projector backfill
  3. open the Overview
  4. confirm every section renders real figures that match direct database counts for three spot-checked numbers

  Verify with PR screenshots of each section, and the spot-check numbers in the PR description.

## Workflow follow-up

- After both PRs are merged and deployed, open one large course's Overview to confirm the gradual build, then archive this change.
