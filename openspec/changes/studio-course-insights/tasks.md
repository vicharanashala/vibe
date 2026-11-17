# Tasks

**Checks to run:**
- **Backend** (from `backend/`):
  - `npx vitest run <files>`
  - `npx tsc --noEmit -p .`
  - `bash .github/scripts/check-backend-format.sh origin/main <out>` (run from the repo root)
- **v3** (from `v3/`):
  - `npx vitest run --root apps/student`
  - `npx tsc -b apps/student/tsconfig.app.json apps/student/tsconfig.spec.json`

**Release order:** the backend groups (1–5) land as one backend PR and are deployed first. The v3 groups (6–9) are a separate PR.

## 1. Backend: read-model storage

- [ ] 1.1 Create `modules/analytics` (container, types, module registration). Define the `ca_*` document interfaces from design §2 and the `ca_state` interface (watermark, lastRefreshedAt, firstBuildCompletedAt, status, lease). Verify that `npx tsc --noEmit` passes and the module loads in the existing container bootstrap test.
- [ ] 1.2 Add `AnalyticsRepository`:
  - collection getters
  - `{versionId, …}` indexes for every `ca_*` collection
  - replace-style writes per learner and per item
  - `acquireLease`/`releaseLease` using `findOneAndUpdate` where `leaseUntil < now`

  Verify with mongodb-memory-server tests: two concurrent `acquireLease` calls give exactly one winner, and an expired lease can be retaken.
- [ ] 1.3 Add the read-side source indexes `anomaly_records {versionId, createdAt}` and `user_activity_events {courseVersionId, updatedAt}`, created in the background on start-up. Verify with a test that the indexes exist after `init()`, and check `git diff` to confirm no write-path code changed.

## 2. Backend: per-learner projection (tiers 1–2)

- [ ] 2.1 Implement roster loading: enrollments of the version with the exclusion filter (non-STUDENT roles, `isShareLinkGuest`, `isQuickShareContainer`), joined with `progress` using a projection. Verify with a test where staff, a guest and a quick-share holder are excluded and an unenrolled learner's rows are deleted.
- [ ] 2.2 Implement learning-time attribution:
  - closed `watchTime` viewings capped at 3× video length (3 h for non-video items)
  - split across IST hours and days into `ca_learner_days.secondsByHour`

  Verify with unit tests: a viewing crossing midnight IST, an over-long abandoned viewing being capped, and an open viewing being ignored.
- [ ] 2.3 Implement the `ca_learners` fields:
  - `percent`, `completedAt`, `lastActiveAt`
  - `currentItemId`/`currentItemSince` (design §4)
  - `furthestModuleIndex` and `completedModuleIds`, using visible items in course order
  - `usedStrict`/`usedStudy`
  - `incidentCount`

  Verify with fixture tests: hidden/deleted items ignored, `currentItemSince` kept when the item is unchanged and reset when it changes.
- [ ] 2.4 Implement `ca_learner_quizzes`: attempts ordered by `submittedAt`, `firstAttemptPassed`, `attemptsToPass`, first/best score %, and the first attempt's per-question status. Verify with tests: fail-then-pass gives 2 attempts to pass with first attempt not passed; a never-passed learner has no `attemptsToPass`.
- [ ] 2.5 Implement `ca_learner_videos`: started/completed flags, and rewind counts per 10-second segment from `user_activity_events.rewindData[].to`. Verify with a test where rewinds to 4:12 and 4:18 both land in the 4:10 segment.
- [ ] 2.6 Implement `ca_learner_days.incidentsByType` and `enrolled` from `anomaly_records` and `enrollmentDate`, bucketed by IST day. Verify with a test placing an incident at 23:50 IST on the correct day.

## 3. Backend: course summaries (tier 3) and the projector

- [ ] 3.1 Implement the tier-3 aggregation from tiers 1–2, covering:
  - `ca_course_daily`: active learners as distinct learner-days, seconds, new enrolments, incidents
  - `ca_course_heatmap` by day
  - `ca_item_stats` for quizzes: pass rate, attempts to pass, 10-point score bands, 5 hardest questions
  - `ca_item_stats` for videos: started, completed, top segments
  - `ca_course_snapshot`: headline metrics for each range and its previous period, progress bands, funnel, where-now with median time, check-on top 50, study-mode split, median days to finish

  Verify each spec scenario in `specs/backend/course-analytics` as a unit test on fixture tier-1/2 rows, including that the bands add up to the roster and that a quiet day appears as zeros.
- [ ] 3.2 Implement `AnalyticsProjector.refreshVersion`, following design §3:
  1. take the lease
  2. set `upTo = now − 2 min`
  3. find dirty learners from the five sources, plus the roster diff
  4. recompute their tiers 1–2
  5. re-aggregate tier 3
  6. advance the watermark
  7. release the lease

  Verify with mongodb-memory-server tests:
  - new activity appears after a refresh
  - a refresh made to throw midway leaves the watermark unchanged, and a rerun gives the same figures with nothing double-counted
  - a version with no new activity is skipped
- [ ] 3.3 Implement `rebuildVersion` (all learners, then tier 3, then set `firstBuildCompletedAt`) and `refreshAllActive` (versions with active student enrolments, one at a time, failures logged and counted). Verify with a test that a rebuild after incremental refreshes gives identical documents, and that a deliberately drifted figure is corrected by the rebuild.
- [ ] 3.4 Write a projector guard test: run the projector against a fixture database snapshot, then confirm that the documents in `enrollment`, `progress`, `watchTime`, `quiz_attempts`, `quiz_submission_results`, `anomaly_records`, `studyViews` and `user_activity_events` are byte-identical before and after. This verifies the "derived only from existing records" requirement.

## 4. Backend: scheduling and entry points

- [ ] 4.1 Add a `build/jobs/analyticsProjector.js` entrypoint (source `src/jobs/analyticsProjector.ts`). It takes `refresh`, `rebuild` or `backfill`, boots the DI container without the HTTP server, runs, and exits with a non-zero code on failure. Verify by running `node build/jobs/analyticsProjector.js backfill` against the local `vibe_v3_local*` database and seeing every seeded course get `firstBuildCompletedAt`.
- [ ] 4.2 Add the node-cron fallback `bootstrap/jobs/analyticsProjector.ts`, gated by `ENABLE_ANALYTICS_PROJECTOR_JOB`. It runs refresh every 5 min and rebuild at 02:30 Asia/Kolkata, defaults off in production, and is documented next to the flag in `config/app.ts`. Verify with a test that the job does nothing when the flag is false.
- [ ] 4.3 Document the Cloud Run Job and Cloud Scheduler setup (resources, args, memory, schedule), the backfill and the rollback in `backend/docs/analytics-projector.md`, taking them from design's Migration Plan. Verify that the commands in the doc match the entrypoint arguments.

## 5. Backend: API

- [ ] 5.1 Add `GET /analytics/courses/:courseId/versions/:versionId/overview?range=7|30|90`:
  - validators and an OpenAPI response schema matching design §6
  - reads only `ca_course_snapshot`, `ca_item_stats`, and range slices of `ca_course_daily`/`ca_course_heatmap`
  - names joined from the course structure
  - `status: 'building'` before the first build

  Verify with controller tests: 30-day shape, rejection of `range=14`, building state, and a query-count assertion of at most 5 database reads.
- [ ] 5.2 Authorise the overview with the same ability check as `/users/enrollments/.../statistics`. Verify with tests: an instructor of the course is allowed; a student and an instructor of another course are both refused with 403.
- [ ] 5.3 Add `POST /analytics/courses/:courseId/versions/:versionId/rebuild` (admin only). It starts `rebuildVersion` in the background and returns 202. Verify with tests: admin gets 202 and `ca_state` later shows a new refresh time; a non-admin instructor is refused with 403.
- [ ] 5.4 Load-check the overview against a generated 10,000-student fixture version. Verify that p95 is under 1 s across 50 sequential requests in the local stack, and record the timing in the PR.
- [ ] 5.5 Regenerate the v3 API types (`pnpm --filter @vibe/api generate` against the local backend). Verify that `npx tsc -b apps/student/tsconfig.app.json` passes in v3.

## 6. v3: data and page frame

- [x] 6.1 Add the shadcn `chart` component through the shadcn CLI (it brings in Recharts), and code-split the insights section so student routes don't load it. Verify that the student course page bundle has no `recharts` chunk (`pnpm nx build student` and inspect the chunk list).
- [x] 6.2 Add `features/admin/insights/queries.ts` with `useCourseInsights(courseId, versionId, range)` (`staleTime` 5 min). Add `range` (7/30/90, default 30) to the course route's search params. Verify with a spec that changing the range updates the URL and refetches with the new range.
- [x] 6.3 Build the Overview frame:
  - range `ToggleGroup`
  - "Updated N minutes ago"
  - skeletons while loading
  - "being prepared" for `status: 'building'`
  - the no-students empty state
  - the existing finished students, action tiles, registration link and description kept

  Verify with specs for each state and that the registration link is still present.

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

- After both PRs are merged and deployed: create the Cloud Run Job and Cloud Scheduler triggers, run the backfill, then archive this change.
