# Proposal

## Why

A teacher opening a course in ViBe Studio today sees four numbers: students, average progress, finished, and lessons. Those numbers can't answer the questions teachers actually ask:
- Where are students getting stuck?
- Which quiz is too hard?
- Who has gone quiet?
- When do people study?
- Is proctoring catching real problems?

This week a whole cohort sat stuck on one video after failing a quiz, and nobody could see it from Studio. It took production logs and database queries to find. The Overview tab should make that kind of thing obvious at a glance.

Computing these figures live means scanning every viewing session, attempt and incident for a course on each page load. The existing "average watch hours" figure already had to move into a precomputed collection (`courseVersionStats`) for exactly this reason. So the new analytics get their own read models: small collections shaped for the charts, kept up to date in the background, and read with simple indexed lookups.

## What Changes

- **Studio Overview tab (v3)** becomes an insights dashboard, laid out as several sections:
  - **Headline metrics**, each with a trend against the previous period:
    - students
    - active this week
    - average progress
    - finished
    - median days to finish
    - total learning hours
  - **Activity**:
    - daily active learners and learning hours over the selected range (7 / 30 / 90 days)
    - new enrolments per day
    - a weekday × hour heatmap of when students study, in IST
  - **Progress**:
    - progress distribution, with students bucketed by percent complete
    - a module-by-module funnel (how many students reached and finished each module), so the steepest drop-off stands out
  - **Where students are now**: the lessons most students are currently sitting on, with how long they've been there. This flags a lesson where many students have been stuck for days.
  - **Quizzes**, per quiz:
    - first-attempt pass rate
    - average attempts needed to pass
    - score distribution
    - the questions answered correctly least often
  - **Videos**:
    - completion rate per video
    - the moments students rewind to most (from the existing rewind/fast-forward tracking)
  - **Students to check on**:
    - students with no activity for 7+ days who haven't finished
    - students stuck on one lesson for 3+ days

    Each row links to the student in People.
  - **Proctoring**:
    - incidents per 100 learning hours, by type, over time
    - the share of students with any incident
  - **Study mode vs strict mode**: how many students use each.
  - Every section says when its numbers were last updated, and shows a clear empty state for a new course.
- **Course analytics read models (backend, ships as its own PR before the v3 PR)**:
  - **New collections**, kept up to date per course version:
    - daily course activity
    - per-learner state
    - per-lesson stats
    - per-question stats
    - an activity heatmap
    - proctoring by day
    - video rewind hotspots
  - **A background projector** updates them every few minutes from the existing source collections, starting from where it last stopped. A nightly full rebuild corrects any drift.
  - **No changes to how progress, quizzes or watch time are written.** The projector only reads. Students' paths aren't touched, so a projector bug can't break learning.
  - **One read endpoint for the Overview tab**, with the same access as the existing course statistics endpoint. It returns every panel from the read models with indexed lookups only.
  - **An admin endpoint** to rebuild one course version's analytics on demand.
  - **Not BREAKING**: existing endpoints, including `/statistics` and `courseVersionStats`, keep working unchanged.

## Capabilities

### New Capabilities
- `backend/course-analytics`: the analytics read models for each course version, how they are kept up to date (incremental projector, nightly rebuild, on-demand rebuild), how fresh they are, and the read endpoint the Studio Overview uses.
- `v3/studio-course-insights`: what the ViBe Studio course Overview tab shows teachers (metrics, charts, lists, ranges, freshness, empty states) and how they move from an insight to the students behind it.

### Modified Capabilities
<!-- None: no existing spec covers the Studio course overview or course analytics. -->

## Impact

- **Backend:**
  - A new `modules/analytics` (repository, projector service, controller).
  - A new cron job in `bootstrap/jobs`, gated by an env flag like `ENABLE_ENROLLMENT_STATS_JOB`.
  - New collections with indexes.
  - It reads `enrollment`, `progress`, `watchTime`, `quiz_attempts`, `quiz_submission_results`, `user_quiz_metrics`, `anomaly_records`, `studyViews`, `user_activity_events` and the course structure. It writes only the new collections.
  - Needs a backend deploy before the v3 deploy. The first run backfills existing courses.
- **v3:**
  - `features/admin/course-detail-page.tsx`: the Overview tab.
  - New `features/admin/insights/*` components and queries.
  - The shadcn `chart` component, which brings in Recharts as a new dependency.
  - API types regenerated for the new endpoint.
- **Project rule:** `openspec/config.yaml` says v3 changes are frontend-only, and backend work must be called out as a separate change. The read models are backend work the user explicitly asked for, so they are specified here as their own capability and land as a separate backend PR ahead of the v3 PR.
