# Spec Delta

## MODIFIED Requirements

### Requirement: Strict mode keeps today's rules
Strict mode SHALL keep the existing certified-mode behaviour: lessons in order when the course has linear progression on, proctoring with the resolved detectors, and progress recorded. It SHALL be the only mode that records progress. When the course has linear progression off, strict mode SHALL open any lesson and SHALL NOT show lessons as locked for being out of order. An unset setting counts as on.

#### Scenario: Strict mode on a computer
- **WHEN** a student completes a video in strict mode on a computer
- **THEN** progress is recorded exactly as certified mode records it today

#### Scenario: Linear progression off
- **WHEN** a course has linear progression off and a student in strict mode opens a lesson they haven't reached
- **THEN** the lesson opens with proctoring and progress tracking as usual

#### Scenario: Linear progression on or unset
- **WHEN** a course has linear progression on, or has never set it, and a student in strict mode opens a lesson they haven't reached
- **THEN** they're told to finish the earlier lessons first

#### Scenario: Instructor lock with linear progression off
- **WHEN** a course has linear progression off and a student opens a lesson the instructor locked
- **THEN** it stays locked
