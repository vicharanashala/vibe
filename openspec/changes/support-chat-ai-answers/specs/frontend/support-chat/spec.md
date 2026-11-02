# Spec Delta

## Purpose

What learners see and can do in the Support Assistant chat widget of the `frontend/` app.

## ADDED Requirements

### Requirement: Readable answers and feedback in the widget
The learner chat widget SHALL render answers with their numbered steps, bullets and clickable links, SHALL let learners rate FAQ and AI answers, and SHALL offer the issue-report form when a learner rates an answer "Not helpful".

#### Scenario: Not helpful
- **WHEN** a learner marks an AI answer "Not helpful"
- **THEN** the issue-report form appears under it, and submitting it escalates that question
