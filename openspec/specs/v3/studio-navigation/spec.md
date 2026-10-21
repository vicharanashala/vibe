# v3/studio-navigation Specification

## Purpose

How people move around ViBe Studio's sidebar, including quick access to the courses they opened most recently.

## Requirements

### Requirement: Recent courses under Courses
The studio sidebar SHALL list, under the Courses item, up to 5 of the signed-in user's most recently opened courses, newest first, each showing the course's cover art and its name.

#### Scenario: Several courses opened
- **WHEN** the user has opened courses A, B, C, D, E and F in the studio, in that order
- **THEN** the sidebar lists F, E, D, C and B under Courses, and not A

#### Scenario: Opening a course again moves it to the top
- **WHEN** the user's recent courses are C, B, A and they open A again
- **THEN** the sidebar lists A, C, B, with A appearing once

#### Scenario: Long course names
- **WHEN** a recent course's name is longer than the sidebar is wide
- **THEN** the name is cut off with an ellipsis and the full name is still available to assistive technology

### Requirement: Opening a course records it
The studio SHALL record a course as recently opened when the user opens that course's page or one of its lesson editors.

#### Scenario: Course page
- **WHEN** the user opens a course's page on any of its tabs
- **THEN** that course becomes the first of their recent courses

#### Scenario: Lesson editor
- **WHEN** the user opens a lesson editor inside a course
- **THEN** that course becomes the first of their recent courses

### Requirement: Open a recent course from the sidebar
Selecting a recent course in the sidebar SHALL open that course in the studio, and the course currently open SHALL be marked as the current item.

#### Scenario: Selecting a recent course
- **WHEN** the user selects a recent course in the sidebar
- **THEN** the studio shows that course's page

#### Scenario: Current course is highlighted
- **WHEN** the user is on a course's page and that course is in the recent list
- **THEN** its sidebar entry is marked as the current page

### Requirement: Only courses the user can see
The recent list SHALL include only courses that currently appear in the user's studio course list, so deleted courses and courses the user no longer teaches are left out.

#### Scenario: Course no longer available
- **WHEN** a course in the user's history no longer appears in their studio course list
- **THEN** it is not shown, and the next recent course takes its place

### Requirement: Newest courses before any history
When the user has no recent courses on this device, the sidebar SHALL list up to 5 of their courses, newest first, in the same place and style.

#### Scenario: First visit
- **WHEN** a user with 8 courses opens the studio for the first time on a device
- **THEN** the sidebar lists their 5 newest courses under Courses

#### Scenario: No courses
- **WHEN** the user has no courses in the studio
- **THEN** nothing is listed under Courses

### Requirement: History is per user
The recent-course history SHALL be kept separately for each signed-in user, and a stored history that is missing or unreadable SHALL behave as no history.

#### Scenario: Two accounts on one browser
- **WHEN** one user signs out and another signs in on the same browser
- **THEN** the second user does not see the first user's recent courses

#### Scenario: Storage unavailable
- **WHEN** the browser blocks storage or the stored history is corrupt
- **THEN** the sidebar shows the newest courses and the studio keeps working
