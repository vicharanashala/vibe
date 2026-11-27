# Spec Delta

## Purpose

How teachers choose in ViBe Studio who is approved automatically when registering for a course, and how the screen explains the matching rules.

## ADDED Requirements

### Requirement: Choose who is approved
When "Approve automatically" is on, Studio SHALL let the teacher choose between everyone and only listed emails, showing the saved choice. The email list SHALL appear only for listed emails.

#### Scenario: Course that approves everyone
- **WHEN** a teacher opens a course whose saved mode is `EVERYONE`
- **THEN** "Everyone" is selected and no email list is shown

#### Scenario: Course with a list
- **WHEN** a teacher opens a course whose saved mode is `LIST`
- **THEN** "Only these emails" is selected and the list is shown

### Requirement: Saving sends the choice
Saving SHALL send the chosen mode with the list. Choosing everyone and saving SHALL NOT need any list entries.

#### Scenario: Saving a list
- **WHEN** a teacher chooses "Only these emails", enters `bob@gmail.com` and saves
- **THEN** the request has mode `LIST` and that entry

#### Scenario: Empty list warning
- **WHEN** "Only these emails" is chosen and the list is empty
- **THEN** the screen says nobody will be approved automatically

### Requirement: Help text explains exact matching
The help text SHALL say that a full address matches only itself, that a domain matches only that domain and not its subdomains, and that everyone else waits for the teacher.

#### Scenario: Reading the help
- **WHEN** a teacher views the email list
- **THEN** the help text explains these rules and no longer says an address is approved if it contains an entry

### Requirement: Rejected entries are shown
When the backend rejects an entry, Studio SHALL show the error and keep what the teacher typed.

#### Scenario: Invalid entry
- **WHEN** a teacher saves the entry `iitm`
- **THEN** the error naming `iitm` is shown and the text stays in the list
