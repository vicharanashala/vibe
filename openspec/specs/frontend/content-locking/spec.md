# frontend/content-locking Specification

## Purpose

How teachers lock and unlock content in the production app, and how its student pages show locked content.

## Requirements

### Requirement: Teachers set the lock
The selected-item side panel on the teacher course page SHALL offer Inherit, Locked and Open for a module, section or lesson, showing the saved value and what it currently resolves to. A failed save SHALL show an error and keep the saved value.

#### Scenario: Locking a section
- **WHEN** a teacher chooses Locked for a section
- **THEN** the setting is saved and the panel says the section is locked for students

#### Scenario: Inherited
- **WHEN** a teacher selects a lesson inside a locked module, with no setting of its own
- **THEN** the panel says it is locked through inheritance

### Requirement: Locked lessons are marked in the course drawer
The student course drawer SHALL show lessons locked by the instructor as locked, in linear and non-linear courses, using the same inheritance as the backend.

#### Scenario: Non-linear course
- **WHEN** a student views the drawer of a non-linear course with a locked lesson
- **THEN** that lesson shows as locked, and the others don't

#### Scenario: Open lesson in a locked module
- **WHEN** one lesson is set to open inside a locked module
- **THEN** that lesson doesn't show as locked

### Requirement: Locked message instead of the lesson
When the backend refuses a lesson with `CONTENT_LOCKED`, the course page SHALL say the instructor locked it, not that lessons unlock in order. With no earlier lesson to go back to, the lesson area SHALL show that message.

#### Scenario: Moved onto a locked lesson from another lesson
- **WHEN** a student on an open lesson goes to one that the backend refuses as locked, such as one locked after the drawer loaded
- **THEN** a message says the instructor locked it, and the student stays on the open lesson

#### Scenario: Course opens on a locked lesson
- **WHEN** a student's current lesson is locked and they open the course
- **THEN** the lesson area says the instructor locked it

### Requirement: Locked message in phone study mode
The phone study screen SHALL say the instructor locked the lesson when the backend refuses it with `CONTENT_LOCKED`, and keep the outline available.

#### Scenario: Locked lesson on a phone
- **WHEN** a student picks a locked lesson on a phone
- **THEN** the screen says the instructor locked it, and they can pick another lesson
