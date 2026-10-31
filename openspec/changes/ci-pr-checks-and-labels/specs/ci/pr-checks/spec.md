# Spec Delta

## Purpose

Which automated checks run on a pull request to `main`, what they report to the author, and when a pull request may be merged.

## ADDED Requirements

### Requirement: v3 frontend checks
A pull request that changes any file under `v3/` SHALL run lint, typecheck and the Vitest unit tests for the v3 student app and its shared packages, and the v3 check SHALL fail if any of them fails. Playwright end-to-end tests SHALL NOT be run.

#### Scenario: v3 change that keeps everything working
- **WHEN** a pull request changes a file under `v3/` and lint, typecheck and every unit test pass
- **THEN** the v3 check passes

#### Scenario: v3 change that breaks a test
- **WHEN** a pull request changes a file under `v3/` and one unit test fails
- **THEN** the v3 check fails

#### Scenario: v3 change that breaks lint or types
- **WHEN** a pull request changes a file under `v3/` and lint or typecheck reports an error
- **THEN** the v3 check fails, even if every unit test passes

#### Scenario: Playwright tests are left alone
- **WHEN** a pull request changes only `v3/apps/student-e2e/`
- **THEN** the v3 check runs the student app's checks and does not run, lint or typecheck the Playwright project

### Requirement: OpenSpec checks
A pull request that changes any file under `openspec/` or the OpenSpec workflow files under `.claude/` SHALL validate every spec, active change and archived change strictly, and SHALL check that the installed OpenSpec workflow files match the pinned OpenSpec version; the OpenSpec check SHALL fail if any of these fails.

#### Scenario: Valid plan
- **WHEN** a pull request adds a change under `openspec/changes/` whose specs and tasks validate
- **THEN** the OpenSpec check passes

#### Scenario: Malformed spec
- **WHEN** a pull request adds a delta spec with a requirement that has no scenario
- **THEN** the OpenSpec check fails and names the file and the problem

#### Scenario: Hand-edited workflow files
- **WHEN** a pull request edits a file under `.claude/skills/openspec-*` so it no longer matches what the pinned OpenSpec version generates
- **THEN** the OpenSpec check fails and says to run `openspec update`

### Requirement: Checks report the same way on every pull request
Each area's check (backend tests, backend format, v3, OpenSpec) SHALL report one result on every pull request to `main`, passing without running when the pull request doesn't touch that area.

#### Scenario: Pull request outside an area
- **WHEN** a pull request changes only files under `backend/`
- **THEN** the v3 and OpenSpec results pass without running their checks

#### Scenario: Pull request inside an area
- **WHEN** a pull request changes files under both `backend/` and `v3/`
- **THEN** the backend and v3 checks both run, and each result reflects its own check

### Requirement: Report on the pull request
The v3 and OpenSpec checks SHALL keep one report comment on the pull request up to date for its latest commit, showing pass or fail per check, test counts, and each failing test or validation finding, and SHALL mention the author only when something needs fixing.

#### Scenario: Everything passes
- **WHEN** the v3 and OpenSpec checks pass on the latest commit
- **THEN** the comment shows them passing, with the test counts, and does not mention the author

#### Scenario: A test fails
- **WHEN** a v3 unit test fails on the latest commit
- **THEN** the comment lists that test with its error message and asks the author, by mention, to fix it

#### Scenario: New commit
- **WHEN** the author pushes another commit and the checks finish again
- **THEN** the same comment is updated rather than a new one added

#### Scenario: Pull request from a fork
- **WHEN** the pull request comes from a fork
- **THEN** the checks run and the comment is still posted, without running the fork's code with write access

### Requirement: Merging needs passing checks
A pull request to `main` SHALL be mergeable only when the backend tests, backend format, v3 and OpenSpec results have all passed on its latest commit.

#### Scenario: Failing check blocks merge
- **WHEN** a pull request's v3 result has failed
- **THEN** GitHub does not allow it to be merged until a later commit passes

#### Scenario: Unrelated pull request isn't blocked
- **WHEN** a pull request changes only documentation
- **THEN** all four results pass and it can be merged
