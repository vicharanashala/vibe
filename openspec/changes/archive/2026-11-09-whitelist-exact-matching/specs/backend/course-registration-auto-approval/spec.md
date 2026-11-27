# Spec Delta

## Purpose

Decides which students are approved automatically when they register for a course or cohort, and how teachers' auto-approval settings are saved and kept.

## ADDED Requirements

### Requirement: Whitelist entries match exactly
An entry with text before the `@` SHALL match only that exact address. An entry that is only a domain, with or without a leading `@`, SHALL match only addresses at exactly that domain. Matching SHALL ignore case and surrounding spaces, and SHALL NOT match on part of an address.

#### Scenario: Exact address
- **WHEN** the list contains `bob@gmail.com` and `Bob@Gmail.com` registers
- **THEN** the registration is approved

#### Scenario: Address that merely contains an entry
- **WHEN** the list contains `bob@gmail.com` and `jimbob@gmail.com` registers
- **THEN** the registration stays pending

#### Scenario: Domain entry
- **WHEN** the list contains `iitm.ac.in` or `@iitm.ac.in` and `a@iitm.ac.in` registers
- **THEN** the registration is approved

#### Scenario: Lookalike domain
- **WHEN** the list contains `iitm.ac.in` and `x@iitm.ac.in.evil.com` registers
- **THEN** the registration stays pending

#### Scenario: Subdomain
- **WHEN** the list contains `iitm.ac.in` and `a@cs.iitm.ac.in` registers
- **THEN** the registration stays pending

#### Scenario: Older partial entry
- **WHEN** a stored list contains `iitm` and `a@iitm.ac.in` registers
- **THEN** the registration stays pending

### Requirement: The account email is what is checked
Matching SHALL use the email on the student's account, never a value from the submitted registration form.

#### Scenario: Listed email typed into the form
- **WHEN** a student whose account email isn't listed enters a listed email in the form
- **THEN** the registration stays pending

### Requirement: Approving everyone is an explicit choice
Auto-approval SHALL have a mode, `EVERYONE` or `LIST`. With `EVERYONE`, every registration SHALL be approved. With `LIST`, only matching registrations SHALL be approved, and an empty list SHALL approve nobody. When auto-approval is off, no registration SHALL be approved automatically, whatever the mode.

#### Scenario: Everyone
- **WHEN** auto-approval is on with mode `EVERYONE` and any student registers
- **THEN** the registration is approved

#### Scenario: Empty list
- **WHEN** auto-approval is on with mode `LIST` and an empty list, and a student registers
- **THEN** the registration stays pending

#### Scenario: Auto-approval off
- **WHEN** auto-approval is off, the mode is `EVERYONE`, and a student registers
- **THEN** the registration stays pending

### Requirement: Existing settings keep their meaning
When no mode is stored, the mode SHALL be `EVERYONE` if the list is empty or missing, and `LIST` otherwise. The settings read SHALL return the resulting mode, for the course and for each cohort.

#### Scenario: Course set up before this change, no list
- **WHEN** a stored setting has auto-approval on, no mode and an empty list, and a student registers
- **THEN** the registration is approved, and the settings read returns mode `EVERYONE`

#### Scenario: Course set up before this change, with a list
- **WHEN** a stored setting has auto-approval on, no mode and a list
- **THEN** the settings read returns mode `LIST`, and only matching registrations are approved

### Requirement: Saving auto-approval settings
Saving SHALL store the mode, and trim, lower-case and de-duplicate list entries. While auto-approval is on with mode `LIST`, it SHALL reject entries that aren't an address or a domain with a 400 naming them, and store nothing. A save with no mode SHALL take its mode from the list as in "Existing settings keep their meaning".

#### Scenario: Save normalises entries
- **WHEN** a teacher saves ` Bob@Gmail.com ` and `bob@gmail.com` with mode `LIST`
- **THEN** the stored list is `bob@gmail.com`

#### Scenario: Invalid entry
- **WHEN** a teacher saves the entry `iitm`
- **THEN** the request is rejected with 400 naming `iitm`, and the stored settings are unchanged

#### Scenario: Turning auto-approval off with an old entry
- **WHEN** a course's stored list contains `iitm` and a teacher saves auto-approval off with that list
- **THEN** the save succeeds and the entry stays stored

#### Scenario: Client that sends no mode
- **WHEN** an older client saves auto-approval on with an empty list and no mode
- **THEN** the stored mode is `EVERYONE`

### Requirement: Saving the form keeps auto-approval settings
Saving the registration form SHALL keep the stored auto-approval on/off value, mode and list unless the request includes them.

#### Scenario: Form saved without auto-approval values
- **WHEN** a teacher with a saved list saves the form with only its schemas
- **THEN** auto-approval, the mode and the list are unchanged

### Requirement: Cohorts follow the same rules
A course version with cohorts SHALL apply these matching, mode, compatibility and saving rules to the settings of the cohort the student registers for.

#### Scenario: Cohort list
- **WHEN** a cohort's list contains `bob@gmail.com`, and `jimbob@gmail.com` registers for that cohort
- **THEN** the registration stays pending

#### Scenario: Cohort with mode saved
- **WHEN** a teacher saves mode `LIST` with an empty list for a cohort, and a student registers for that cohort
- **THEN** the registration stays pending

### Requirement: Approval outcome and pending requests
A matching registration SHALL be approved and enrolled on submission, with the existing approval email. Changing the settings SHALL NOT change requests that are already pending.

#### Scenario: Matching student
- **WHEN** a listed student submits the registration form
- **THEN** the response status is `APPROVED` and the student is enrolled

#### Scenario: List changed later
- **WHEN** a student's request is pending and a teacher adds their address to the list
- **THEN** the request stays pending and no email is sent
