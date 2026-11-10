# Spec Delta

## MODIFIED Requirements

### Requirement: Quizzes are strict-mode only
Quizzes SHALL be attempted only in strict mode. Study mode SHALL NOT show quizzes in the course syllabus, its lesson counts or its Previous/Next navigation, SHALL hide sections and modules that contain only quizzes, and SHALL never continue to a quiz. A quiz opened directly in study mode SHALL show that it must be taken in strict mode on a computer, with an action to switch.

#### Scenario: Quiz in study mode
- **WHEN** a student in study mode opens a quiz item from a link
- **THEN** no attempt starts, and they are told quizzes are taken in strict mode on a computer, with an action to switch

#### Scenario: Study syllabus
- **WHEN** a student views a course's syllabus in study mode
- **THEN** quizzes are not listed, a module with only quizzes is not shown, and the lesson count leaves quizzes out

#### Scenario: Study navigation
- **WHEN** the lesson after a student's current lesson is a quiz and they press Next in study mode
- **THEN** they go to the first lesson after it that isn't a quiz

#### Scenario: Continuing after a quiz
- **WHEN** a student's current item is a quiz and they open the course in study mode
- **THEN** "Study where you left off" opens the next lesson after the quiz

#### Scenario: Strict mode unchanged
- **WHEN** a student views the same course in strict mode
- **THEN** quizzes are listed and counted as before
