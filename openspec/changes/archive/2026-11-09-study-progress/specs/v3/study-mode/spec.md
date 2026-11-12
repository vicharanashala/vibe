# Spec Delta

## MODIFIED Requirements

### Requirement: Study mode is free viewing
In study mode the app SHALL open any video or reading where study mode is allowed, in any order, whatever the course's linear-progression setting. It SHALL let the student rewatch and seek freely, run no proctoring, and save no strict progress. It SHALL record study views as described by the study progress requirements.

#### Scenario: Linear course in study mode
- **WHEN** a course has linear progression on and a student in study mode opens a lesson they haven't reached
- **THEN** the lesson opens, and their strict-mode progress and current lesson are unchanged

#### Scenario: Course outline in study mode
- **WHEN** a student in study mode views the course outline
- **THEN** lessons are not shown as locked because of linear progression

#### Scenario: Rewatching
- **WHEN** a student in study mode replays or seeks anywhere in a video
- **THEN** playback follows the student with no snap-back and no limit on replays
