# backend/content-locking Specification

## Purpose

Stores whether each module, section and lesson of a course version is locked, resolves that through inheritance, and refuses students at every entry point to locked lessons without changing their progress.

## Requirements

### Requirement: Lock setting on modules, sections and lessons
Modules, sections and lessons SHALL each carry an optional lock setting: locked, open, or unset. Unset means "inherit". Content created before this feature SHALL read as unset.

#### Scenario: Existing content
- **WHEN** a module, section or lesson that has never had the setting is read
- **THEN** its lock setting is unset and students can open it as before

#### Scenario: Copying a course version
- **WHEN** a course version with lock settings is copied or transferred
- **THEN** the new version's modules, sections and lessons keep the same settings

#### Scenario: Other edits keep the setting
- **WHEN** another lesson in the section is hidden or reordered
- **THEN** a lesson's lock setting is unchanged

### Requirement: Lock inheritance
A lesson's effective value SHALL come from the most specific level that is set: lesson, then section, then module. When none is set, the lesson SHALL be open.

#### Scenario: Module locked
- **WHEN** a module is locked and neither the section nor the lesson is set
- **THEN** the lesson is locked

#### Scenario: One lesson stays open
- **WHEN** a module is locked and one of its lessons is set to open
- **THEN** that lesson is open, and the module's other unset lessons are locked

#### Scenario: Section overrides module
- **WHEN** a module is open, its section is locked and the lesson is unset
- **THEN** the lesson is locked

### Requirement: Teachers set or clear the lock
The backend SHALL provide endpoints that set a module's, section's or lesson's lock to locked, open or unset. They SHALL accept only callers allowed to modify that course version, and record an audit entry.

#### Scenario: Locking a section
- **WHEN** an instructor of the course locks a section
- **THEN** the request succeeds and the section's unset lessons resolve to locked

#### Scenario: Clearing the setting
- **WHEN** an instructor sets a lesson's lock to unset
- **THEN** the lesson inherits from its section and module again

#### Scenario: Student cannot change it
- **WHEN** a caller who can't modify the course version sends any of these requests
- **THEN** the request is rejected with 403 and nothing changes

#### Scenario: Unknown target
- **WHEN** the request names a module, section or lesson that isn't in the version
- **THEN** the request is rejected with 404

#### Scenario: Archived version
- **WHEN** the course version is archived
- **THEN** the request is rejected with 403 and nothing changes

### Requirement: Course structure reports each own setting
The course version and section lesson-list responses SHALL include each module's, section's and lesson's own lock setting, for students and teachers. Locked content SHALL stay listed.

#### Scenario: Outline of a locked section
- **WHEN** a student loads the outline of a course with a locked section
- **THEN** the section and its lessons are listed, with the section's lock setting

### Requirement: Students can't open a locked lesson
A student's read of a locked lesson SHALL be refused with 403, name `CONTENT_LOCKED` and the level that locked it, in strict and study mode, including lessons they already completed. The refusal SHALL take priority over the study-mode and linear-progression rules, and SHALL NOT return lesson content.

#### Scenario: Strict read
- **WHEN** a student reads a locked video in strict mode
- **THEN** the request is rejected with `CONTENT_LOCKED` and source `module`, `section` or `item`

#### Scenario: Study read
- **WHEN** a student reads a locked video where study mode is allowed, in study mode
- **THEN** the request is rejected with `CONTENT_LOCKED`

#### Scenario: Finished lesson
- **WHEN** a student who completed a lesson reads it after it is locked
- **THEN** the request is rejected with `CONTENT_LOCKED`

#### Scenario: Unlocked again
- **WHEN** the teacher unlocks a lesson the student was refused
- **THEN** the student can read it under the usual rules

### Requirement: The lock can't be avoided by the request
Whether a lesson is locked SHALL be worked out on the server from where the lesson actually sits in the course, never from module or section ids in the request.

#### Scenario: Wrong module in the URL
- **WHEN** a student reads a lesson of a locked module using another module's id in the URL
- **THEN** the request is rejected with `CONTENT_LOCKED`

### Requirement: Locked lessons can't be worked on
For students, the backend SHALL refuse with `CONTENT_LOCKED` starting, stopping or skipping a locked lesson, recording a study view for it, starting a quiz attempt on it, and submitting its feedback form or project. Nothing SHALL be stored by a refused request.

#### Scenario: Start
- **WHEN** a student starts a locked video
- **THEN** the request is rejected and no watch-time record is created

#### Scenario: Stop after the lesson was locked
- **WHEN** a student was watching a video when it was locked, and it is then stopped
- **THEN** the request is rejected and the lesson isn't completed

#### Scenario: New quiz attempt
- **WHEN** a student starts an attempt on a locked quiz
- **THEN** the request is rejected, no attempt is created and no attempt is used up

#### Scenario: Study view
- **WHEN** a student records a study view for a locked video
- **THEN** the request is rejected and nothing is stored

#### Scenario: Feedback or project
- **WHEN** a student submits a locked feedback form or project
- **THEN** the request is rejected and nothing is stored

### Requirement: An attempt already started can finish
A student who started a quiz attempt before the quiz was locked SHALL still be able to save and submit that attempt, and the submission's progress update SHALL still apply.

#### Scenario: Submit after locking
- **WHEN** a quiz is locked while a student is in an attempt, and the student submits it
- **THEN** the submission is graded and recorded as usual

#### Scenario: Stop after submitting
- **WHEN** the student's app stops the quiz lesson after that submission
- **THEN** the stop succeeds

### Requirement: Staff are exempt
The lock SHALL apply only to students. Instructors, managers and teaching assistants of the course SHALL read and work with locked lessons as usual.

#### Scenario: Instructor opens a locked lesson
- **WHEN** an instructor of the course reads a locked lesson
- **THEN** the lesson is returned

### Requirement: Progress is never changed by a lock
Locking or unlocking SHALL NOT change any student's progress, current lesson or completed lessons. Locked lessons SHALL still count in strict and study progress totals.

#### Scenario: Student already past
- **WHEN** a lesson a student already passed is locked
- **THEN** their current lesson and percentage are unchanged

#### Scenario: Totals
- **WHEN** a teacher locks a lesson in a course with 10 lessons
- **THEN** a student's progress total is still 10

### Requirement: Linear courses wait at a locked lesson
In a linear course, completing the lesson before a locked lesson SHALL move the student's current lesson onto the locked one as usual. The student SHALL NOT be able to move past it until it is unlocked, and the course SHALL NOT be marked complete because of it.

#### Scenario: Reaching a locked lesson
- **WHEN** a student completes lesson 2 and lesson 3 is locked
- **THEN** their current lesson becomes lesson 3, reading it is refused with `CONTENT_LOCKED`, and lesson 4 stays closed

#### Scenario: Unlocked
- **WHEN** the teacher then unlocks lesson 3
- **THEN** the student can open it and continue

### Requirement: Non-linear courses close only locked lessons
In a non-linear course, only locked lessons SHALL be refused.

#### Scenario: Other lessons
- **WHEN** a course isn't linear and lesson 3 is locked
- **THEN** a student can open lesson 4
