# Spec Delta

## Purpose

How the production web app lets teachers turn study mode off for modules, sections and items, and lets students watch study-mode videos on a phone without proctoring or recorded progress.

## ADDED Requirements

### Requirement: Teacher study-mode switches
The teacher course editor SHALL let a teacher set study mode to allowed, disallowed or inherit on each module, section and item. It SHALL show the effective value and whether it is inherited.

#### Scenario: Disable a section
- **WHEN** a teacher sets a section's study mode to disallowed in the course editor
- **THEN** the setting is saved, and the section's items show study mode as off (inherited) unless they have their own setting

#### Scenario: Return to inherit
- **WHEN** a teacher chooses inherit on an item that had its own setting
- **THEN** the item shows the value it now inherits from its section or module

### Requirement: Study viewing on a phone
On a phone, a student opening a video where study mode is allowed SHALL be able to watch it in study mode: no proctoring, free seeking and replay, any order, and no progress saved.

#### Scenario: Watch on a phone
- **WHEN** a student on a phone opens a video item where study mode is allowed
- **THEN** the video plays, a banner says it is study mode and doesn't count towards progress, and no progress is recorded

#### Scenario: Linear lock does not apply
- **WHEN** the course has linear progression on and a student on a phone opens a later study-allowed video they haven't reached
- **THEN** the video plays and their progress and current lesson are unchanged

### Requirement: Phone fallback for strict-only content
On a phone, items that can't be opened in study mode (quizzes, items where study mode is disallowed, and non-video items) SHALL keep showing the existing "use a computer" screen. When the instructor has disabled study mode, that screen SHALL say so.

#### Scenario: Instructor-disabled video on a phone
- **WHEN** a student on a phone opens a video whose module disallows study mode
- **THEN** they see the "use a computer" screen, which says the instructor has disabled study mode for this module

#### Scenario: Quiz on a phone
- **WHEN** a student on a phone opens a quiz
- **THEN** they see the "use a computer" screen and no attempt starts

#### Scenario: Unproctored item on a phone
- **WHEN** a student on a phone opens an item whose resolved proctoring detectors are all off
- **THEN** it opens and records progress exactly as it does today

### Requirement: Computer behaviour unchanged
On a computer, the production app SHALL keep its current behaviour for every item: linear progression, proctoring and progress recording as today, whatever the study-mode setting.

#### Scenario: Study-allowed video on a computer
- **WHEN** a student on a computer opens a video where study mode is allowed
- **THEN** it opens with proctoring and progress exactly as it does today
