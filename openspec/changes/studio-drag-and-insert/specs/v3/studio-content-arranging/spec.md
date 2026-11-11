# Spec Delta

## Purpose

How teachers order modules, sections and lessons in ViBe Studio, and add new ones exactly where they belong.

## ADDED Requirements

### Requirement: Drag to reorder
Studio SHALL let teachers drag a lesson within its section, a section within its module, and a module within the course by a grip handle, showing where it will land. The new order SHALL show at once and be saved with one request per drop.

#### Scenario: Dragging a lesson
- **WHEN** a teacher drags the third lesson of a section above the first
- **THEN** it shows first right away, and Studio asks the backend to place it before the first lesson

#### Scenario: Dragging a module
- **WHEN** a teacher drags module 2 above module 1
- **THEN** the modules show in the new order and Studio asks the backend to place module 2 before module 1

#### Scenario: Dropped where it started
- **WHEN** a teacher drops a row back in its own place
- **THEN** nothing is saved

### Requirement: A failed move is undone
When saving a new order fails, Studio SHALL put the previous order back and say the item wasn't moved and why.

#### Scenario: Server error
- **WHEN** the move request fails with "Server unavailable"
- **THEN** the row returns to its old place and a message says it wasn't moved: Server unavailable

### Requirement: Reorder without a mouse
Reordering SHALL work from the keyboard (focus the handle, Space or Enter to pick up, arrow keys to move, Space to drop, Escape to cancel) with screen-reader announcements, on touch screens by long-press, and from each row's menu with Move up and Move down.

#### Scenario: Keyboard
- **WHEN** a teacher focuses a lesson's handle, presses Space, ArrowUp, then Space
- **THEN** the lesson moves up one place and the move is saved

#### Scenario: Row menu
- **WHEN** a teacher picks Move down from a lesson's menu
- **THEN** the lesson is placed after the one below it

### Requirement: Add above or below
Each row SHALL offer Add above and Add below in its menu and a "+" on hover or focus that adds below. Studio SHALL create the new lesson, section or module at that position, never at the end.

#### Scenario: Add a lesson below
- **WHEN** a teacher picks Add below on a lesson and chooses Video, then saves the new video
- **THEN** the video is created directly after that lesson

#### Scenario: Add a section above
- **WHEN** a teacher picks Add above on a section and names the new section
- **THEN** the section is created directly before it

#### Scenario: Empty section
- **WHEN** a section has no lessons
- **THEN** it offers Add lesson, and the lesson is created in that section

### Requirement: The lesson editor outline matches
The lesson editor's outline SHALL offer the same dragging and add-above/below for lessons in each section as the course outline.

#### Scenario: Reorder from the editor
- **WHEN** a teacher drags a lesson in the editor's outline
- **THEN** the order changes and is saved as in the course outline
