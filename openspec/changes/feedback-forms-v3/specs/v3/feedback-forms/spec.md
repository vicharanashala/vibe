# Spec Delta

## Purpose

How students answer feedback forms in the v3 student app, and how teachers build forms, review responses and download feedback exports in ViBe Studio.

## ADDED Requirements

### Requirement: Students answer forms in strict mode
In strict mode a feedback form SHALL show every question, check required answers before sending, send the answers and then move the student to the next lesson. A form with no required questions SHALL also offer Skip.

#### Scenario: Sending a form
- **WHEN** a student fills a form's required questions and presses Send
- **THEN** the answers are sent, they see a thank-you message and the next lesson opens

#### Scenario: Missing required answer
- **WHEN** a student presses Send with a required question empty
- **THEN** nothing is sent and that question is marked with a message

### Requirement: Students see and update their answers
A form the student already answered SHALL open with their current answers filled in and the date they sent them. Sending again SHALL update their answer.

#### Scenario: Reopening an answered form
- **WHEN** a student reopens a form they answered last week
- **THEN** their answers are filled in with "You answered this on" and the date, and the button reads Update

#### Scenario: Continuing without changes
- **WHEN** a student reopens an answered form and presses Continue without editing
- **THEN** nothing is sent again and the next lesson opens

### Requirement: Clear reasons when a form can't be sent
When the backend refuses a submission, the form SHALL show the reason in plain language and keep the student's answers.

#### Scenario: Video not finished
- **WHEN** a student opens a form whose video they haven't finished and presses Send
- **THEN** the form says to finish the previous video first, with a link to it, and their answers stay filled in

### Requirement: Students answer forms in study mode
Strict mode is PC-only, so study mode is how phones answer. In study mode a form SHALL be fillable and sendable when the course allows it, with the same validation, the student's current answer filled in, and Update when answered. It SHALL NOT change strict progress.

#### Scenario: Answering on a phone
- **WHEN** a student on a phone opens a form in study mode and sends their answers
- **THEN** the answers are stored as a study-mode answer and their strict progress is unchanged

#### Scenario: Video not studied yet
- **WHEN** a student sends a study-mode form whose video they haven't studied
- **THEN** the form explains why, links to the video, and keeps their answers

### Requirement: Read-only when the course turns study-mode feedback off
When the course doesn't accept study-mode feedback, a form in study mode SHALL show its questions read-only, with the student's current answer, and a note that answers are accepted only in strict mode.

#### Scenario: Turned off
- **WHEN** a student opens a form in study mode in a course that turned study-mode feedback off
- **THEN** the questions are disabled and there is no Send button

### Requirement: Studio switch for study-mode feedback
The course Feedback tab SHALL offer "Students can send feedback in study mode", on by default, explaining that turning it off stops students on phones from sending feedback. Responses SHALL show whether each answer came from study or strict mode.

#### Scenario: Turning it off
- **WHEN** a teacher turns the switch off
- **THEN** it stays off and students' study-mode forms become read-only

### Requirement: Feedback screens work on phones
Every feedback screen SHALL work at 360 px wide without sideways page scrolling: the student form in both modes, Studio responses, summary, the response pane (full width on phones), download menus and the Feedback tab. Controls SHALL be at least 40 px tall on phones.

#### Scenario: A 1 to 10 scale on a phone
- **WHEN** a student opens a form with a 1 to 10 scale on a 360 px wide phone
- **THEN** the scale wraps onto rows with its end labels, and nothing scrolls sideways

### Requirement: Form builder field kinds
The Studio form builder SHALL offer:
- the existing kinds (short text, long text, number, email, URL, phone, date, single choice, dropdown, checkboxes, rating, yes/no)
- section headings with an optional description
- linear scales with a chosen range and labels for both ends
- an optional "Other (please specify)" choice on single choice and checkboxes

Forms using the new kinds SHALL still render in the old frontend.

#### Scenario: Linear scale
- **WHEN** a teacher adds a 1 to 10 scale labelled "Not useful" and "Very useful"
- **THEN** students see ten options with the two labels at the ends, and answers are stored as the chosen number

#### Scenario: Other choice
- **WHEN** a student picks "Other" and types a reason
- **THEN** both the choice and the typed text are stored and shown in responses and exports

#### Scenario: Section heading
- **WHEN** a teacher adds a section heading between questions
- **THEN** students see it as a heading, not a question, and it asks for no answer

### Requirement: Responses view
Studio SHALL show a form's current responses, newest first, with search by student name or email and a cohort filter for cohort courses. Opening a response SHALL show that student's full answers, their answer history, and the lesson the form is about.

#### Scenario: Search by email
- **WHEN** a teacher searches responses for part of a student's email
- **THEN** only that student's responses are listed

#### Scenario: One student's answers
- **WHEN** a teacher opens a response
- **THEN** they see every question with that student's answer, the time sent, and earlier versions if they updated it

### Requirement: Summary counts every current response
The summary SHALL count every current response, with no upper limit: counts and percentages per choice, averages for ratings, scales and numbers, and the latest text answers.

#### Scenario: Large course
- **WHEN** a form has 4,000 current responses
- **THEN** the summary's counts add up to 4,000

### Requirement: Downloading feedback
Studio SHALL let course staff download one form's responses as CSV or Excel from the form, and the whole course's feedback as an Excel workbook or CSV from the course. Each offers "Latest answers only" (the default) or "Include earlier versions", and a cohort choice for cohort courses. Each SHALL show progress while preparing the file and an error message if it fails.

#### Scenario: Course workbook
- **WHEN** a teacher downloads the course feedback as Excel
- **THEN** they get a workbook named after the course and date, and a confirmation toast

#### Scenario: Export fails
- **WHEN** the export request fails
- **THEN** Studio says the file couldn't be prepared and offers to try again
