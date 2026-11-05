# Spec Delta

## Purpose

Which labels a pull request gets automatically, so the pull request list shows at a glance which parts of the codebase each one touches, what kind of change it is, and how big it is.

## ADDED Requirements

### Requirement: Area labels from changed files
A pull request SHALL carry one area label for each part of the codebase its changed files touch (`backend`, `frontend`, `frontend-v3`, `openspec`, `docs`, `cli`, `e2e`, `tests`, `ci`, `devops`, `dependencies`; the file patterns are in design.md), and SHALL lose an area label when a later commit no longer touches that part.

#### Scenario: v3 change with tests
- **WHEN** a pull request changes `v3/apps/student/src/features/admin/admin-shell.tsx` and a `*.spec.tsx` file
- **THEN** it is labelled `frontend-v3` and `tests`

#### Scenario: OpenSpec plan
- **WHEN** a pull request changes files under `openspec/changes/`
- **THEN** it is labelled `openspec`

#### Scenario: Workflow change
- **WHEN** a pull request changes a file under `.github/workflows/`
- **THEN** it is labelled `ci` and `devops`

#### Scenario: Lockfile change
- **WHEN** a pull request changes `pnpm-lock.yaml`, `v3/pnpm-lock.yaml` or any app's `package.json`
- **THEN** it is labelled `dependencies`

#### Scenario: Backend and current frontend together
- **WHEN** a pull request changes files under `backend/` and `frontend/`
- **THEN** it is labelled `backend` and `frontend`, and not `frontend-v3`

#### Scenario: CLI and docs
- **WHEN** a pull request changes `cli/src/index.ts` and `docs/getting-started.md`
- **THEN** it is labelled `cli` and `docs`

#### Scenario: Playwright tests
- **WHEN** a pull request changes a file under `e2e/` or `v3/apps/student-e2e/`
- **THEN** it is labelled `e2e` and `tests`

#### Scenario: Deployment config
- **WHEN** a pull request changes `firebase.json` or a file under `self-hosting/`
- **THEN** it is labelled `devops`

#### Scenario: Area no longer touched
- **WHEN** a later commit removes the pull request's only change under `v3/`
- **THEN** the `frontend-v3` label is removed

### Requirement: Type label from the title
A pull request SHALL carry one type label taken from its title's conventional prefix: `feature` for `feat`, `bug` for `fix`, `documentation` for `docs`, `refactor`, `chore`, `ci` and `tests` for `test`, recognising a scope in parentheses and a trailing `!`. A title with no recognised prefix SHALL get no type label.

#### Scenario: Scoped prefix
- **WHEN** a pull request is titled `fix(v3): keep dialogs inside the screen`
- **THEN** it is labelled `bug`

#### Scenario: Title edited
- **WHEN** the title changes from `feat: add export` to `fix: export crash`
- **THEN** the `feature` label is replaced by `bug`

#### Scenario: Unprefixed title
- **WHEN** a pull request is titled `v3: Explore page for public courses`
- **THEN** it gets no type label

### Requirement: Size label
A pull request SHALL carry exactly one size label from its added plus deleted lines, excluding lockfiles and generated OpenSpec workflow files: `size/XS` (under 10), `size/S` (under 100), `size/M` (under 500), `size/L` (under 1000) or `size/XL` (1000 or more).

#### Scenario: Small fix
- **WHEN** a pull request adds 12 lines and deletes 3
- **THEN** it is labelled `size/S`

#### Scenario: Size changes
- **WHEN** a later commit grows the pull request from 80 to 600 changed lines
- **THEN** `size/S` is replaced by `size/L`

#### Scenario: Lockfile churn
- **WHEN** a pull request changes 5 source lines and 3,000 lines of `pnpm-lock.yaml`
- **THEN** it is labelled `size/XS`
