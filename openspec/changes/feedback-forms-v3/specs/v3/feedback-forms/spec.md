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

### Requirement: Study mode shows a read-only preview
In study mode a feedback form SHALL show its questions read-only with a note that answers are sent only in strict mode, plus the student's current answers when they have any.

#### Scenario: Study mode preview
- **WHEN** a student opens a form in study mode
- **THEN** they see the questions disabled and a note to switch to strict mode to answer

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
