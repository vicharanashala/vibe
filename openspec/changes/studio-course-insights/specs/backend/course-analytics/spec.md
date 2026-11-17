# Spec Delta

## Purpose

Precomputed, chart-shaped analytics for each course version, kept up to date in the background from the learning records, so teacher dashboards read them cheaply instead of querying raw records on every page load.

## ADDED Requirements

### Requirement: Read models are derived only from existing records
Course analytics SHALL be computed solely from the records the platform already keeps (enrolments, progress, viewing sessions, quiz attempts and results, proctoring incidents, study views, rewind/fast-forward events and course structure). Keeping analytics up to date MUST NOT write to any of those records or change how they are written.

#### Scenario: Projector never alters learning records
- **WHEN** the analytics are refreshed for a course version
- **THEN** no enrolment, progress, viewing-session, quiz or incident record is created, changed or deleted

#### Scenario: Analytics failure does not affect students
- **WHEN** refreshing analytics fails for a course version
- **THEN** students of that course can still start, finish and progress through lessons and quizzes exactly as before

### Requirement: Incremental refresh
The system SHALL refresh each active course version's analytics in the background at least every 10 minutes, processing only records added or changed since that version's last successful refresh.

#### Scenario: New activity appears
- **WHEN** a student finishes a video and the next refresh completes
- **THEN** that course's daily learning hours, the video's completion count and the student's last-active time include it

#### Scenario: Refresh resumes after a failure
- **WHEN** a refresh stops partway through
- **THEN** the next refresh picks up from the last successful point, with no activity counted twice or missed

### Requirement: Single refresher at a time
At most one refresh SHALL run for a given course version at any moment, even when several backend instances are running.

#### Scenario: Two instances start the job together
- **WHEN** two backend instances begin a refresh of the same course version at the same time
- **THEN** only one performs it and the other skips that version

### Requirement: Full rebuild
The system SHALL be able to rebuild a course version's analytics from scratch, producing the same figures an incremental refresh would. It SHALL do this nightly for active course versions and on demand by an administrator.

#### Scenario: Nightly rebuild corrects drift
- **WHEN** a figure has drifted from the underlying records and the nightly rebuild runs
- **THEN** the figure afterwards matches a direct count from the records

#### Scenario: Administrator triggers a rebuild
- **WHEN** an administrator requests a rebuild of one course version
- **THEN** the request is accepted straight away, the version's analytics are recomputed in the background, and once finished the overview's last-refreshed time reflects the rebuild

#### Scenario: Non-administrator cannot trigger a rebuild
- **WHEN** an instructor who is not an administrator requests a rebuild
- **THEN** the request is refused with a forbidden error

### Requirement: Backfill on first deploy
After the analytics feature is first deployed, every course version with enrolled students SHALL have analytics available without manual action.

#### Scenario: Existing course after deploy
- **WHEN** an instructor opens analytics for a course version that existed before the deploy
- **THEN** the figures reflect its full history, or the response says the first build is still in progress

### Requirement: Learner exclusions
Analytics SHALL count only enrolled students. Instructors, teaching assistants, managers, share-link guests and quick-share containers MUST be excluded, matching the existing course statistics.

#### Scenario: Instructor previews a lesson
- **WHEN** an instructor watches a video in their own course
- **THEN** none of the course's analytics figures change

### Requirement: Course overview analytics endpoint
The backend SHALL expose one endpoint returning a course version's overview analytics for a requested range of 7, 30 or 90 days. Each request is answered from the precomputed analytics only.

#### Scenario: Instructor requests 30 days
- **WHEN** an instructor of the course requests the overview for the last 30 days
- **THEN** the response contains every overview panel defined below, for the 30 days ending today in IST

#### Scenario: Unsupported range
- **WHEN** a range other than 7, 30 or 90 days is requested
- **THEN** the request is rejected with a validation error

#### Scenario: Response time on a large course
- **WHEN** the overview is requested for a course version with 10,000 enrolled students
- **THEN** the response arrives within 1 second at the 95th percentile

### Requirement: Access control
Only users allowed to view the existing course statistics SHALL be able to read a course version's analytics.

#### Scenario: Student requests analytics
- **WHEN** a student of the course requests its analytics
- **THEN** the request is refused with a forbidden error

#### Scenario: Instructor of another course
- **WHEN** an instructor who does not teach this course requests its analytics
- **THEN** the request is refused with a forbidden error

### Requirement: Freshness is reported
Every overview response SHALL include the time the analytics were last successfully refreshed. If a first build hasn't finished yet, the response SHALL say so.

#### Scenario: Normal response
- **WHEN** the overview is requested
- **THEN** the response includes the last successful refresh time

#### Scenario: First build pending
- **WHEN** the overview is requested for a course version whose first build hasn't completed
- **THEN** the response says the build is in progress and returns no figures for that version

### Requirement: Headline metrics with comparison
The overview SHALL include these headline metrics, each for the selected range and for the equal-length range before it:
- enrolled students
- students active in the last 7 days
- average progress
- students finished
- median days from enrolment to finishing
- total learning hours

#### Scenario: Trend against the previous period
- **WHEN** 12 students finished in the last 30 days and 8 in the 30 days before that
- **THEN** the response reports 12 for the current period and 8 for the previous period

### Requirement: Daily activity series
The overview SHALL include, for each IST day in the range, the number of distinct students active that day, their total learning hours and the number of new enrolments, with zero for days without activity.

#### Scenario: Student active twice in a day
- **WHEN** a student watches two videos on the same day
- **THEN** that day's active-student count includes them once

#### Scenario: Quiet day
- **WHEN** no student is active on a day inside the range
- **THEN** that day appears with zero active students, zero hours and its enrolment count

### Requirement: Study-time heatmap
The overview SHALL include learning time grouped by IST weekday and hour of day, over the selected range.

#### Scenario: Evening study
- **WHEN** students record 3 hours of viewing on Mondays between 20:00 and 21:00 IST in the range
- **THEN** the Monday 20:00 cell reports 3 hours

### Requirement: Progress distribution
The overview SHALL include how many enrolled students fall into each progress band: 0%, 1–24%, 25–49%, 50–74%, 75–99% and finished.

#### Scenario: Bands add up
- **WHEN** a course version has 200 enrolled students
- **THEN** the band counts add up to 200

### Requirement: Module funnel
The overview SHALL include, for each module in course order, how many students have reached it and how many have completed every lesson in it.

#### Scenario: Drop-off between modules
- **WHEN** 180 students completed module 1 and 95 reached module 2
- **THEN** the funnel reports module 1 completed 180 and module 2 reached 95

#### Scenario: Hidden or deleted modules
- **WHEN** a module is hidden or deleted
- **THEN** it does not appear in the funnel

### Requirement: Where students are now
The overview SHALL list, ordered by student count, the lessons students are currently on. For each lesson it SHALL give the number of students there and the median time they have been there.

#### Scenario: Students stuck after a failed quiz
- **WHEN** 15 students' current lesson has been the same video for several days
- **THEN** that video is listed with 15 students and the median time they have been on it

### Requirement: Quiz insights
For each quiz in the course version, the overview SHALL include:
- the number of students who attempted it
- first-attempt pass rate
- average attempts needed to pass
- a score distribution in 10-point bands
- up to 5 questions with the lowest share of correct answers

#### Scenario: Pass on second attempt
- **WHEN** a student fails a quiz and passes it on the next attempt
- **THEN** that student counts as not passing on the first attempt and as needing 2 attempts to pass

#### Scenario: Hardest questions
- **WHEN** one question in a quiz was answered correctly by 20% of students and the others by over 60%
- **THEN** that question is listed first among the quiz's hardest questions

### Requirement: Video insights
For each video, the overview SHALL include how many students started and completed it, and its top rewind hotspots. Hotspots are the 10-second segments most often rewound to.

#### Scenario: Confusing moment
- **WHEN** many students rewind to the segment between 4:10 and 4:20 of a video
- **THEN** that segment is listed among the video's rewind hotspots with its rewind count

### Requirement: Students to check on
The overview SHALL list unfinished students who have had no activity for 7 or more days, and students who have stayed on the same lesson for 3 or more days, each with the reason, the lesson and the time since they were last active.

#### Scenario: Inactive student
- **WHEN** an unfinished student was last active 9 days ago
- **THEN** they are listed as inactive for 9 days

#### Scenario: Finished student
- **WHEN** a student finished the course and has been inactive for 30 days
- **THEN** they are not listed

### Requirement: Proctoring insights
The overview SHALL include proctoring incidents per 100 learning hours by incident type for each IST day in the range, and the share of enrolled students with at least one incident in the range.

#### Scenario: Incident rate
- **WHEN** a day has 40 no-face incidents and 20 learning hours
- **THEN** that day reports 200 no-face incidents per 100 learning hours

### Requirement: Study mode usage
The overview SHALL include how many students have used only strict mode, only study mode, or both.

#### Scenario: Mixed use
- **WHEN** a student has studied lessons in study mode and completed lessons in strict mode
- **THEN** they are counted under "both"
