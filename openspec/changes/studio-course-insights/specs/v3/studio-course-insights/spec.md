# Spec Delta

## Purpose

What teachers see on a course's Overview tab in ViBe Studio: charts, metrics and lists that show how students are doing and where they need help, and how to get from an insight to the students behind it.

## ADDED Requirements

### Requirement: Range selector
The Overview tab SHALL let the teacher choose a range of 7, 30 or 90 days, defaulting to 30. Every range-dependent chart and metric SHALL update to that range. The choice SHALL be kept in the page URL.

#### Scenario: Switch to 7 days
- **WHEN** the teacher selects "7 days"
- **THEN** the activity charts, headline trends and proctoring chart show the last 7 days, and reloading the page keeps 7 days selected

### Requirement: Headline metrics with trends
The Overview tab SHALL show these headline metrics, each with its change against the previous equal period shown as an up or down indicator with a value:
- students
- active this week
- average progress
- finished
- median days to finish
- learning hours

#### Scenario: More students finished
- **WHEN** 12 students finished this period and 8 the period before
- **THEN** the Finished metric shows 12 with an upward indicator of +4

#### Scenario: No previous data
- **WHEN** the previous period has no data
- **THEN** the metric shows its value without a trend indicator

### Requirement: Activity charts
The Overview tab SHALL show daily active students, daily learning hours and daily new enrolments over the range (one chart, switched by selecting a metric tile), and a weekday × hour heatmap of study time in IST.

#### Scenario: Hover a day
- **WHEN** the teacher points at or focuses a day on the activity chart
- **THEN** a tooltip shows that date with its active students and learning hours

#### Scenario: Heatmap peak
- **WHEN** most study time falls on weekday evenings
- **THEN** those heatmap cells are the most intense, and each cell's value is available in a tooltip

### Requirement: Progress charts
The Overview tab SHALL show the progress distribution as bars by band, and a module funnel giving, for each module in order, how many students reached and finished it. The funnel SHALL highlight the largest drop between consecutive modules.

#### Scenario: Biggest drop-off highlighted
- **WHEN** the largest fall between "finished" of one module and "reached" of the next is between modules 3 and 4
- **THEN** that step is highlighted and labelled with the number of students lost

### Requirement: Where students are now
The Overview tab SHALL list the lessons most students are currently on, with the student count and the median time there. A lesson where at least 5 students have been for a median of 3 days or more SHALL be flagged as a possible blocker.

#### Scenario: Blocker flagged
- **WHEN** 15 students have been on the same video for a median of 4 days
- **THEN** that video is listed with 15 students, "4 days", and a possible-blocker flag

#### Scenario: Open the lesson
- **WHEN** the teacher selects a listed lesson
- **THEN** the Studio opens that lesson's editor

### Requirement: Quiz insights
The Overview tab SHALL show each quiz's first-attempt pass rate and average attempts to pass, sorted with the lowest first-attempt pass rate first. Selecting a quiz SHALL show its score distribution and its hardest questions with the share answered correctly.

#### Scenario: Hardest quiz first
- **WHEN** one quiz has a 35% first-attempt pass rate and the others are above 70%
- **THEN** that quiz is listed first

#### Scenario: Open a quiz's detail
- **WHEN** the teacher selects a quiz
- **THEN** its score distribution chart and up to 5 hardest questions, with their text and percent correct, are shown

### Requirement: Video insights
The Overview tab SHALL show each video's completion rate. Selecting a video SHALL show its rewind hotspots as timestamps with counts.

#### Scenario: Rewind hotspot
- **WHEN** a video's most rewound segment is 4:10–4:20
- **THEN** the video's detail lists "4:10" first with its rewind count

### Requirement: Students to check on
The Overview tab SHALL list students to check on (inactive for 7+ days or on the same lesson for 3+ days), with name, reason, lesson and time since last active. Each entry SHALL open that student's row in the People tab.

#### Scenario: Go to the student
- **WHEN** the teacher selects a student in the list
- **THEN** the People tab opens filtered to that student

#### Scenario: Nobody to check on
- **WHEN** no student meets either condition
- **THEN** the section says everyone is active and moving

### Requirement: Proctoring and study-mode insights
The Overview tab SHALL show proctoring incidents per 100 learning hours by type over the range, the share of students with any incident, and how many students used strict mode only, study mode only, or both.

#### Scenario: Proctoring off
- **WHEN** the course has no proctoring checks turned on and no incidents in the range
- **THEN** the proctoring section says proctoring is off instead of showing an empty chart

### Requirement: Freshness and states
The Overview tab SHALL show loading placeholders while fetching, show an explanatory empty state for a course with no students, and while the first build is in progress show "Preparing insights" with a progress bar and check again every 3 seconds until the figures are ready.

#### Scenario: Build progress
- **WHEN** the backend reports the first build is 40% done
- **THEN** the page shows "Preparing insights" with a progress bar at 40%

#### Scenario: Build finishes
- **WHEN** a later check reports the analytics are ready
- **THEN** the page stops checking and shows the figures

#### Scenario: New course
- **WHEN** the course has no enrolled students
- **THEN** the page shows an empty state inviting the teacher to invite students, and no empty charts

#### Scenario: First build in progress
- **WHEN** the backend reports the first build is in progress
- **THEN** the existing course actions remain available

### Requirement: Existing overview actions remain
The Overview tab SHALL keep the existing finished-students list, the Content, Invite people and Proctoring tiles, the registration link and the course description.

#### Scenario: Registration link still there
- **WHEN** the teacher opens the Overview tab
- **THEN** the registration link and its copy button are present

### Requirement: Accessible charts
Every chart SHALL have a text title, a visible or screen-reader summary of its main takeaway, and keyboard-reachable tooltips. Colours SHALL work in light and dark themes and SHALL NOT be the only way information is conveyed.

#### Scenario: Screen reader
- **WHEN** a screen-reader user reaches the progress distribution chart
- **THEN** they hear its title and the count in each band

#### Scenario: Narrow screen
- **WHEN** the Overview tab is viewed at phone width
- **THEN** charts stack in one column with no horizontal page scrolling
