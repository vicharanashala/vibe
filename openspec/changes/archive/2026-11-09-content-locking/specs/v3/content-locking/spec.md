# Spec Delta

## Purpose

How teachers lock and unlock content in ViBe Studio, and how the v3 student app shows locked content in the outline and in place of the lesson.

## ADDED Requirements

### Requirement: Teachers set the lock in Studio
Each module, section and lesson menu in Studio's content tab SHALL offer Inherit, Locked and Open, showing the saved value. A failed save SHALL show an error and keep the saved value.

#### Scenario: Locking a module
- **WHEN** a teacher chooses Locked for a module
- **THEN** the setting is saved and the module shows as locked

#### Scenario: Failed save
- **WHEN** saving the lock fails
- **THEN** an error is shown and the menu still shows the saved value

### Requirement: Studio shows what is locked
Studio SHALL mark content locked here, content locked through inheritance, and content set to open inside something locked.

#### Scenario: Inherited
- **WHEN** a module is locked
- **THEN** its sections and lessons show as locked (inherited) once loaded

#### Scenario: Open inside a locked module
- **WHEN** a lesson is set to open inside a locked module
- **THEN** that lesson shows as open

### Requirement: Locked content is marked in the student outline
The course page SHALL keep locked modules, sections and lessons in the outline with a lock icon and a label saying the instructor locked them. It SHALL work this out with the same inheritance as the backend, in strict and study mode.

#### Scenario: Locked lesson
- **WHEN** a student views the outline of a course with a locked lesson
- **THEN** the lesson is listed with a lock icon, labelled as locked by the instructor

#### Scenario: Finished lesson locked
- **WHEN** the locked lesson is one the student completed
- **THEN** it still shows as completed, and is also marked as locked

#### Scenario: Open lesson in a locked module
- **WHEN** one lesson is set to open inside a locked module
- **THEN** that lesson has no lock icon

### Requirement: Locked screen instead of the lesson
When the backend refuses a lesson with `CONTENT_LOCKED`, the lesson page SHALL show a screen saying the instructor locked this module, section or lesson, with a link back to the course. It SHALL NOT offer to switch mode or suggest the student finish earlier lessons, on any device.

#### Scenario: Strict mode
- **WHEN** a student opens a locked lesson in strict mode
- **THEN** the locked screen is shown, naming the level that locked it

#### Scenario: Study mode on a phone
- **WHEN** a student opens a locked lesson in study mode on a phone
- **THEN** the locked screen is shown, not the continue-on-a-computer screen

#### Scenario: Linear lock unchanged
- **WHEN** a student opens a lesson they haven't reached, and it isn't locked by the instructor
- **THEN** the existing "finish the earlier lessons first" screen is shown

### Requirement: Locking while a lesson is open
If starting or stopping a lesson is refused with `CONTENT_LOCKED`, the app SHALL show the locked screen. A student in a quiz attempt SHALL be able to finish submitting it.

#### Scenario: Locked while watching
- **WHEN** a video is locked while a student is watching and the app's stop is refused with `CONTENT_LOCKED`
- **THEN** the locked screen is shown

#### Scenario: Quiz in progress
- **WHEN** a quiz is locked during a student's attempt and they submit it
- **THEN** the submission completes and they see the result
