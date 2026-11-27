# frontend/course-registration-auto-approval Specification

## Purpose

How teachers choose in the production app who is approved automatically when registering for a course or cohort, and how the screen explains the matching rules.

## Requirements

### Requirement: Choose who is approved
When auto-approval is on, the modal SHALL let the teacher choose between everyone and only listed emails, showing the saved choice for the course or the selected cohort. The email list SHALL appear only for listed emails.

#### Scenario: Selected cohort
- **WHEN** a teacher selects a cohort whose saved mode is `LIST`
- **THEN** "Only these emails" is selected and that cohort's list is shown

### Requirement: Saving sends the choice
Saving SHALL send the chosen mode with the list and the selected cohort, if any. If the backend rejects an entry, the modal SHALL stay open and show the backend's message.

#### Scenario: Saving a list
- **WHEN** a teacher chooses "Only these emails", adds `bob@gmail.com` and saves
- **THEN** the request has mode `LIST` and that entry

#### Scenario: Invalid entry
- **WHEN** a teacher saves the entry `iitm`
- **THEN** the modal stays open and shows the error naming `iitm`

### Requirement: Help text explains exact matching
The help text SHALL say that a full address matches only itself, that a domain matches only that domain and not its subdomains, and that with an empty list nobody is approved automatically. It SHALL NOT say that an empty list approves everyone.

#### Scenario: Reading the help
- **WHEN** a teacher views the email list
- **THEN** the help text explains these rules
