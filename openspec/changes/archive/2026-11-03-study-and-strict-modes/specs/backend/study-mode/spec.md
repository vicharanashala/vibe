# Spec Delta

## Purpose

Stores whether study mode is allowed on each module, section and item of a course version, resolves that setting through inheritance, and serves lessons for study mode without the linear-progression lock and without recording progress.

## ADDED Requirements

### Requirement: Study-mode setting on modules, sections and items
Modules, sections and items SHALL each carry an optional study-mode setting: allowed, disallowed, or unset. Unset means "inherit". Content created before this feature reads as unset.

#### Scenario: Existing content reads as unset
- **WHEN** a module, section or item that has never had the setting is read
- **THEN** its study-mode setting is unset

#### Scenario: Setting survives a version copy
- **WHEN** a course version with study-mode settings is copied or transferred
- **THEN** the new version's modules, sections and items keep the same settings

### Requirement: Study-mode inheritance
For an item, the effective value SHALL come from the most specific level that is set: item first, then its section, then its module. When none of them is set, study mode SHALL be allowed.

#### Scenario: Nothing set
- **WHEN** neither the item, its section nor its module has a study-mode setting
- **THEN** study mode is allowed for the item

#### Scenario: Module disallows
- **WHEN** the module disallows study mode and neither the section nor the item is set
- **THEN** study mode is disallowed for the item

#### Scenario: Item overrides its module
- **WHEN** the module disallows study mode and the item allows it
- **THEN** study mode is allowed for that item, and disallowed for the module's other unset items

#### Scenario: Section overrides its module
- **WHEN** the module allows study mode, the section disallows it, and the item is unset
- **THEN** study mode is disallowed for the item

### Requirement: Teachers set or clear the study-mode setting
The backend SHALL provide endpoints that set a module's, section's or item's study-mode setting to allowed, disallowed or unset. They SHALL accept only callers allowed to modify that course version, the same rule as the existing proctoring overrides.

#### Scenario: Instructor disallows study mode for a section
- **WHEN** an instructor of the course sets a section's study mode to disallowed
- **THEN** the request succeeds and the section's items without their own setting resolve to disallowed

#### Scenario: Clearing the setting
- **WHEN** an instructor sets an item's study mode to unset
- **THEN** the item inherits from its section and module again

#### Scenario: Student cannot change the setting
- **WHEN** a caller who cannot modify the course version sends any of these requests
- **THEN** the request is rejected with 403 and nothing changes

#### Scenario: Unknown module, section or item
- **WHEN** the request names a module, section or item that does not exist in the version
- **THEN** the request is rejected with 404

### Requirement: Lesson responses report the effective study-mode value
The lesson read response SHALL include whether study mode is allowed for that item, resolved through inheritance. Course-structure responses for teachers SHALL include each module's, section's and item's own setting, so editors can tell "set here" from "inherited".

#### Scenario: Student opens a lesson
- **WHEN** an enrolled student reads an item whose module disallows study mode
- **THEN** the response says study mode is not allowed for that item

#### Scenario: Teacher views course structure
- **WHEN** a teacher loads the course version structure
- **THEN** each module, section and item shows its own setting: allowed, disallowed or unset

### Requirement: Study-mode lesson read
A lesson read that asks for study mode SHALL return the item when study mode is allowed for it and it is not a quiz, even if linear progression would lock it. It SHALL NOT change the student's progress or current position.

#### Scenario: Reading ahead in study mode
- **WHEN** linear progression is on and an enrolled student asks for a later, not-yet-reached video in study mode, and study mode is allowed for it
- **THEN** the video is returned and the student's progress and current item are unchanged

#### Scenario: Study mode disallowed
- **WHEN** a student asks for an item in study mode where study mode resolves to disallowed
- **THEN** the request is rejected with 403 and an error code identifying study mode as disabled, and the student's progress is unchanged

#### Scenario: Quiz in study mode
- **WHEN** a student asks for a quiz item in study mode
- **THEN** the request is rejected with 403 and an error code identifying quizzes as strict-mode only

#### Scenario: Not enrolled
- **WHEN** a user not enrolled in the course asks for an item in study mode
- **THEN** the request is rejected exactly as a normal lesson read would be

### Requirement: Normal lesson reads are unchanged
A lesson read that does not ask for study mode SHALL behave exactly as before this change, including the linear-progression checks and the current-item update, whatever the study-mode setting.

#### Scenario: Strict read of a study-allowed item
- **WHEN** linear progression is on and a student reads a not-yet-reached item without asking for study mode
- **THEN** the request is rejected as it is today, even though study mode is allowed for that item
