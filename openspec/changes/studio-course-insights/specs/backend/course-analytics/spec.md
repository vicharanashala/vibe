# Spec Delta

## Purpose

Precomputed, chart-shaped analytics for each course version, kept up to date in the background from the learning records, so teacher dashboards read them cheaply instead of querying raw records on every page load.

## ADDED Requirements

### Requirement: Learning flows are never affected
Keeping analytics up to date MUST NOT change what is stored in enrolment, progress, viewing-session, quiz or incident records. It MUST NOT make any student request fail or wait noticeably longer: analytics updates happen only after the student's own change has been saved, and any analytics error is logged and ignored.

#### Scenario: Analytics update fails
- **WHEN** updating analytics after a quiz submission fails
- **THEN** the student's submission still succeeds and is saved exactly as before

#### Scenario: Learning records unchanged
- **WHEN** analytics are built or updated for a course version
- **THEN** no enrolment, progress, viewing-session, quiz or incident record is created, changed or deleted by that work

### Requirement: Updated when events happen
Once a course version's analytics are built, the system SHALL update them as each relevant event happens, with no scheduled recomputation:
- a quiz is submitted
- a video or lesson is finished
- a student enrols or leaves
- a student's current lesson changes
- a student finishes the course
- a proctoring incident is recorded
- a lesson is studied in study mode
- a video is rewound

#### Scenario: Quiz attempt
- **WHEN** a student submits a quiz attempt
- **THEN** the next overview request reflects it in that quiz's attempts, pass figures, score bands and question figures

#### Scenario: Lesson finished
- **WHEN** a student finishes a video
- **THEN** the next overview request includes it in that day's learning hours and active students and in the video's completion count

### Requirement: Each event counted once
An event SHALL change the analytics at most once, even if the request that caused it is retried or the update runs twice.

#### Scenario: Retried stop
- **WHEN** the same lesson-finished request is processed twice
- **THEN** the lesson's completion and the day's learning time are counted once

### Requirement: Time-based figures computed when read
Figures that change with the passage of time rather than with events SHALL be computed when the overview is requested, from the per-student analytics rather than raw records. These are inactivity, time on the current lesson, and medians.

#### Scenario: Student goes quiet
- **WHEN** an unfinished student has no events for 8 days
- **THEN** the overview requested today lists them as inactive for 8 days, although no event occurred

### Requirement: First build happens gradually on demand
A course version with no analytics yet SHALL be built when its overview is first requested. The build advances in bounded steps during overview requests, so no single request does more than a few seconds of work or holds the whole course in memory. Until it completes, responses report the build's progress.

#### Scenario: First visit to an existing course
- **WHEN** an instructor opens the overview of a course that has history but no analytics yet
- **THEN** the response says the build is in progress with a percentage, and repeated requests advance it until the full figures are returned

#### Scenario: Visit interrupted
- **WHEN** the instructor closes the page halfway through the first build
- **THEN** the next overview request continues the build from where it stopped

#### Scenario: Events during the build
- **WHEN** students finish lessons while their course's first build is in progress
- **THEN** the completed build includes those events exactly once

### Requirement: One build step at a time
At most one build step SHALL run for a course version at any moment, even across several backend instances or open browser tabs.

#### Scenario: Two tabs
- **WHEN** two instructors open the same course's overview during its first build
- **THEN** each step is performed once, and both see the same progress

### Requirement: Rebuild on request
An administrator SHALL be able to rebuild one course version's analytics from scratch, for example after a suspected error. The rebuild proceeds gradually in the same way as a first build and gives the same figures as event updates would.

#### Scenario: Administrator triggers a rebuild
- **WHEN** an administrator requests a rebuild of one course version
- **THEN** the request is accepted, the overview shows build progress, and once finished the figures match a direct count from the records

#### Scenario: Non-administrator cannot trigger a rebuild
- **WHEN** an instructor who is not an administrator requests a rebuild
- **THEN** the request is refused with a forbidden error

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
- **THEN** the response arrives within 1 second at the 95th percentile, and a build-step response within 5 seconds

### Requirement: Access control
Only users allowed to view the existing course statistics SHALL be able to read a course version's analytics.

#### Scenario: Student requests analytics
- **WHEN** a student of the course requests its analytics
- **THEN** the request is refused with a forbidden error

#### Scenario: Instructor of another course
- **WHEN** an instructor who does not teach this course requests its analytics
- **THEN** the request is refused with a forbidden error

### Requirement: Build status is reported
Every overview response SHALL say whether the course version's analytics are ready or still being built. While building, the response SHALL include progress as a percentage and no figures.

#### Scenario: Ready
- **WHEN** the overview is requested for a built course version
- **THEN** the response says it is ready and includes every figure

#### Scenario: Building
- **WHEN** the overview is requested during the first build
- **THEN** the response says it is building, with its percentage done, and returns no figures

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
