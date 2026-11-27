# Spec Delta

## Purpose

Records which videos and articles a student has studied in study mode, and calculates their study progress alongside (never instead of) strict progress, for the student and for their teachers.

## ADDED Requirements

### Requirement: Record a study view
The backend SHALL let an enrolled student record that they studied a video or article. It SHALL store one study view per student, course version and lesson, keeping the time of the first. It SHALL NOT change strict progress, completion or the current lesson.

#### Scenario: First study of a video
- **WHEN** an enrolled student records a study view for a video in the course version
- **THEN** a study view is stored for that student, version and video, and their strict progress is unchanged

#### Scenario: Recording again
- **WHEN** the student records a study view for a lesson they already studied
- **THEN** the request succeeds, no second record is created, and the first-studied time is kept

### Requirement: Only valid study views are recorded
A study view SHALL be recorded only for a video or article that belongs to the course version, by a caller enrolled in it as a student, where study mode resolves to allowed. Otherwise nothing is stored.

#### Scenario: Quiz
- **WHEN** a student records a study view for a quiz
- **THEN** the request is rejected with 400 and nothing is stored

#### Scenario: Study mode disabled
- **WHEN** a student records a study view for a video whose module disallows study mode
- **THEN** the request is rejected with 403 `STUDY_MODE_DISABLED`, and nothing is stored

#### Scenario: Not enrolled
- **WHEN** a user who is not enrolled in the course version records a study view
- **THEN** the request is rejected and nothing is stored

#### Scenario: Lesson from another version
- **WHEN** the lesson id does not belong to the course version
- **THEN** the request is rejected with 404 and nothing is stored

#### Scenario: Instructor
- **WHEN** an instructor of the course records a study view
- **THEN** the request succeeds without storing anything, because study progress is tracked only for students

### Requirement: Study progress calculation
A student's study progress SHALL be: the visible videos and articles where study mode is allowed that the student has studied or completed in strict mode, over all visible videos and articles where study mode is allowed. It SHALL be calculated from the current course structure and settings each time it is requested.

#### Scenario: Mix of study and strict
- **WHEN** a version has 4 study-allowed videos and articles, and the student studied 1 and completed a different one in strict mode
- **THEN** their study progress is 2 of 4 (50%)

#### Scenario: Strict-only and quiz lessons are left out
- **WHEN** a version has 3 study-allowed videos, 1 video in a module where study mode is off, and 2 quizzes
- **THEN** the total is 3

#### Scenario: Teacher later disables study mode
- **WHEN** a student studied a video and the teacher then disables study mode for its module
- **THEN** that video no longer counts in the total or the studied count, and counts again if study mode is turned back on

#### Scenario: Nothing studyable
- **WHEN** a version has no study-allowed videos or articles
- **THEN** study progress is 0 of 0 with 0%

### Requirement: Student reads their study progress
The backend SHALL return an enrolled student's study progress for a course version: lessons covered, total, a whole-number percentage, and the ids of the lessons that count as covered.

#### Scenario: Reading study progress
- **WHEN** an enrolled student requests their study progress
- **THEN** the response has the covered count, the total, the percentage and the covered lesson ids

#### Scenario: Strict progress unaffected
- **WHEN** a student has study views but no strict completions
- **THEN** their study progress reflects the study views, and their strict progress is still 0%

### Requirement: Teachers see each student's study progress
The course enrollment list available to a course's instructors SHALL include each student's study progress (covered, total, percentage), calculated as above, next to the existing progress.

#### Scenario: Enrollment list
- **WHEN** an instructor loads the course version's enrollment list
- **THEN** each student entry includes its study progress, and the existing progress value is unchanged
