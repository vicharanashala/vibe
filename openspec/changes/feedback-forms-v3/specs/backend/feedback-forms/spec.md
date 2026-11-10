# Spec Delta

## Purpose

How the backend stores feedback form answers (one current answer per student per form, with history, cohort and placement rules) and exports them for any course as rich Excel and CSV files.

## ADDED Requirements

### Requirement: One current answer per student per form
Each new submission SHALL become the student's current answer for that form. Earlier submissions SHALL be kept as history and marked as replaced, never deleted. Counts, summaries and default exports SHALL use only current answers.

#### Scenario: Student updates their answer
- **WHEN** a student who already answered a form submits it again
- **THEN** the new answer is current, the earlier one is kept as history, and the form's response count does not change

#### Scenario: Existing duplicates
- **WHEN** a student has several submissions for one form from before this change
- **THEN** the most recent one counts as current and the others as history, with no data migration

### Requirement: Students can read their own current answer
The API SHALL return the signed-in student's current answer for a feedback form, or none. It SHALL NOT return other students' answers.

#### Scenario: Reopening an answered form
- **WHEN** a student opens a form they answered before
- **THEN** the API returns their current answer and when they sent it

#### Scenario: Another student's answer
- **WHEN** a student asks for a form's answer
- **THEN** only their own answer can be returned

### Requirement: Submissions record the student's cohort
A submission SHALL store the cohort the student is enrolled through for that course version, whether or not the client sends it.

#### Scenario: Cohort course
- **WHEN** a student enrolled through a cohort submits a form without sending a cohort
- **THEN** the submission is stored with that student's cohort

### Requirement: Forms that are first in their section
A feedback form with no lesson before it in its section SHALL be submittable as a general form, about no particular lesson. A form directly after another feedback form SHALL keep being refused.

#### Scenario: Form at the start of a section
- **WHEN** a student submits a form that is the first item of its section
- **THEN** the answer is stored with no "about" lesson, instead of failing

### Requirement: The previous video must be finished first
A form that follows a video SHALL refuse a student who hasn't completed that video, with a message saying so.

#### Scenario: Video not finished
- **WHEN** a student submits the form after a video they haven't completed
- **THEN** the submission is refused with "Watch the previous video before sending this feedback."

### Requirement: Course feedback export
Course staff SHALL be able to export all feedback for any course version as an Excel workbook or as CSV, optionally limited to one cohort. Students and staff of other courses SHALL be refused. It SHALL work for every course, not only listed pilot courses.

#### Scenario: Teacher exports a course
- **WHEN** an instructor of a course requests its feedback export as Excel
- **THEN** they receive a workbook with the course's feedback

#### Scenario: Not course staff
- **WHEN** a student requests a course's feedback export
- **THEN** the request is refused

#### Scenario: One cohort
- **WHEN** a teacher requests the export for one cohort
- **THEN** only that cohort's students and answers are included

### Requirement: Workbook contents
The workbook SHALL contain:
- an Overview sheet with one row per enrolled student
- one sheet per feedback form, with one row per answer
- a "Watch + feedback" sheet with one row per student per video, when the course has videos

#### Scenario: Course with two forms after videos
- **WHEN** a course with two videos, each followed by a form, is exported
- **THEN** the workbook has Overview, one sheet for each form, and Watch + feedback

### Requirement: Rich, readable rows
Every answer row SHALL include:
- the student's account name and email (not what they typed in the form)
- cohort
- module, section and form name
- the lesson the form is about
- submitted time in IST and in ISO 8601

Each question SHALL be its own column, titled with the question text in form order, with choices shown as their labels and multiple choices joined by "; ".

#### Scenario: Choice answers
- **WHEN** a student picked "Very useful" and two checkboxes on a form
- **THEN** the row shows "Very useful", and the two labels joined by "; ", under columns named after the questions

#### Scenario: Question renamed after answers
- **WHEN** a question's label was edited after students answered it
- **THEN** earlier and later answers appear in the same column, under the current label

### Requirement: Overview sheet
The Overview sheet SHALL show, per enrolled student: name, email, cohort, progress percent, forms answered out of total forms, and their last answer time.

#### Scenario: Student who answered nothing
- **WHEN** an enrolled student has answered no forms
- **THEN** they appear on Overview with 0 forms answered

### Requirement: Watch and feedback sheet
The Watch + feedback sheet SHALL show, per enrolled student and video: watch time, watch percent (capped at 100), number of watch sessions, first and last watch time, and the student's current answers to the form directly after that video.

#### Scenario: Watched but no feedback
- **WHEN** a student watched a video but didn't answer its form
- **THEN** the row shows the watch figures and empty answer columns

### Requirement: Latest answers by default
Exports SHALL include only current answers by default. On request, they SHALL include every version, each marked current or replaced.

#### Scenario: Including history
- **WHEN** a teacher exports with all versions included
- **THEN** each replaced answer appears as its own row, marked "Replaced"

### Requirement: Per-form export uses the same rows
The per-form export SHALL offer CSV and Excel with the same columns as that form's sheet in the course workbook.

#### Scenario: Download one form
- **WHEN** a teacher downloads one form's responses as CSV
- **THEN** the CSV has the account name, email, cohort, place, time and question columns described above
