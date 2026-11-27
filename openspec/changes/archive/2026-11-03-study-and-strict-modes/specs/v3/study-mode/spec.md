# Spec Delta

## Purpose

How the v3 student app splits every course into study mode (free viewing on any device, nothing recorded) and strict mode (PC-only, proctored, the only mode that counts), and how ViBe Studio lets teachers turn study mode off for modules, sections and items.

## ADDED Requirements

### Requirement: Two modes, named Study and Strict
The student app SHALL offer two modes per course, labelled "Study mode" and "Strict mode". Strict mode SHALL replace the "Certified mode" label without changing behaviour. A student's saved choice and `?track=` links SHALL keep working.

#### Scenario: Existing saved choice
- **WHEN** a student who had chosen certified mode before this change opens the course
- **THEN** the course opens in strict mode

#### Scenario: Mode labels
- **WHEN** a student opens the mode switcher on a course page
- **THEN** it offers "Study mode" and "Strict mode" with descriptions that say only strict mode counts towards progress

### Requirement: Study mode is free viewing
In study mode the app SHALL open any video or reading where study mode is allowed, in any order, whatever the course's linear-progression setting. It SHALL let the student rewatch and seek freely, run no proctoring, and save no progress.

#### Scenario: Linear course in study mode
- **WHEN** a course has linear progression on and a student in study mode opens a lesson they haven't reached
- **THEN** the lesson opens, and their strict-mode progress and current lesson are unchanged

#### Scenario: Course outline in study mode
- **WHEN** a student in study mode views the course outline
- **THEN** lessons are not shown as locked because of linear progression

#### Scenario: Rewatching
- **WHEN** a student in study mode replays or seeks anywhere in a video
- **THEN** playback follows the student with no snap-back and no limit on replays

### Requirement: Instructor-disabled notice
When study mode is disallowed for an item, study mode SHALL NOT open it. Instead it SHALL say that the instructor has disabled study mode for this module, section or item (naming the level that disallows it) and offer to open it in strict mode.

#### Scenario: Module disabled by the instructor
- **WHEN** a student in study mode opens an item whose module disallows study mode
- **THEN** they see that the instructor has disabled study mode for this module, with an action to switch to strict mode

#### Scenario: Outline marks disabled content
- **WHEN** a student in study mode views the outline of a course where some content disallows study mode
- **THEN** that content is marked as strict-mode only

### Requirement: Quizzes are strict-mode only
Quizzes SHALL be attempted only in strict mode. In study mode a quiz SHALL show that it must be taken in strict mode on a computer, with an action to switch.

#### Scenario: Quiz in study mode
- **WHEN** a student in study mode opens a quiz item
- **THEN** no attempt starts, and they are told quizzes are taken in strict mode on a computer

### Requirement: Strict mode is PC-only
Strict mode SHALL NOT open lessons or quizzes on a device whose primary input is touch. It SHALL show a "continue on a computer" screen instead and, where study mode is allowed for the item, offer to open it in study mode.

#### Scenario: Strict mode on a phone
- **WHEN** a student opens a lesson in strict mode on a phone
- **THEN** the lesson does not start, no progress is recorded, and they are asked to continue on a computer

#### Scenario: Offer study mode on a phone
- **WHEN** that lesson allows study mode
- **THEN** the screen also offers to open it in study mode

#### Scenario: Touchscreen laptop
- **WHEN** a student uses a laptop whose primary input is a mouse or trackpad, even with a touchscreen
- **THEN** strict mode works as normal

### Requirement: Strict mode keeps today's rules
Strict mode SHALL keep the existing certified-mode behaviour: lessons in order when the course has linear progression on, proctoring with the resolved detectors, and progress recorded. It SHALL be the only mode that records progress.

#### Scenario: Strict mode on a computer
- **WHEN** a student completes a video in strict mode on a computer
- **THEN** progress is recorded exactly as certified mode records it today

### Requirement: Studio study-mode switches
ViBe Studio SHALL let a teacher set study mode to allowed, disallowed or inherit on each module, section and item. Each node SHALL show its effective value and whether it is inherited.

#### Scenario: Disable a module
- **WHEN** a teacher sets a module's study mode to disallowed
- **THEN** the module shows "Study mode off", and its sections and items show "Study mode off (inherited)" unless they have their own setting

#### Scenario: Override inside a disabled module
- **WHEN** a teacher sets one video in that module to allowed
- **THEN** that video shows "Study mode on", and the others keep the inherited value

#### Scenario: Save failure
- **WHEN** saving a study-mode setting fails
- **THEN** the switch reverts and an error toast explains it wasn't saved

### Requirement: Studio keeps the course's linear-progression setting
Saving course proctoring or registration settings in Studio SHALL send the course's current linear-progression value, never a default of off.

#### Scenario: Course with an unset linear value
- **WHEN** a teacher saves proctoring settings for a course whose linear-progression value has never been set
- **THEN** linear progression stays on, as the backend treats an unset value
