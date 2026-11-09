# v3/study-progress Specification

## Purpose

How the v3 student app records what a student studies in study mode and shows their study progress next to strict progress, and how ViBe Studio shows each student's study progress to teachers.

## Requirements

### Requirement: Articles count when opened in study mode
When a student opens an article in study mode and it displays, the app SHALL record a study view for it once per visit.

#### Scenario: Opening an article
- **WHEN** a student opens an article in study mode
- **THEN** a study view is recorded for that article

#### Scenario: Strict mode
- **WHEN** a student opens the same article in strict mode
- **THEN** no study view is recorded

### Requirement: Videos count after a short watch
For a video in study mode, the app SHALL record a study view once the video has actually played for 10 seconds in total during the visit, or for its whole length if the clip is shorter. Paused time and seeking SHALL NOT count as playing.

#### Scenario: Ten seconds of playback
- **WHEN** a student plays a study-mode video for 10 seconds, in one go or in pieces
- **THEN** a study view is recorded, once

#### Scenario: Opened but not played
- **WHEN** a student opens a study-mode video and leaves without playing it
- **THEN** no study view is recorded

#### Scenario: Short clip
- **WHEN** a video clip is 6 seconds long and the student plays all of it in study mode
- **THEN** a study view is recorded

### Requirement: Study progress on the course page
The course page SHALL show the student's study progress (covered of total videos and articles, and percentage) next to their strict progress, worded so strict progress is clearly the course's progress.

#### Scenario: Both shown
- **WHEN** a student who has studied 3 of 8 study-allowed lessons and completed 1 in strict mode opens the course page
- **THEN** it shows strict progress as today and study progress of 4 of 8 (50%)

#### Scenario: After studying
- **WHEN** a student studies a new lesson and returns to the course page
- **THEN** the study progress includes it

### Requirement: Covered lessons marked in the study outline
In study mode, the course outline SHALL mark videos and articles that count as covered (studied, or completed in strict mode).

#### Scenario: Studied lesson
- **WHEN** a student in study mode views the outline of a course where they studied a video
- **THEN** that video is marked as studied

### Requirement: Study percentage on course cards
Course cards SHALL show the student's study percentage under the strict progress.

#### Scenario: Course card
- **WHEN** a student with study progress views their courses
- **THEN** each course card shows its study percentage below the strict progress bar

### Requirement: Studio shows study progress per student
The Studio People tab SHALL show each student's study progress next to the existing progress.

#### Scenario: People tab
- **WHEN** a teacher opens a course's People tab
- **THEN** each student row shows their study progress percentage beside their progress
