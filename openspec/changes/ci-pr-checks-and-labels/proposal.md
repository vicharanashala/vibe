# Proposal

## Why

Pull requests can be merged even when they break something. Backend tests and the backend format check run on backend PRs and post a report, but nothing blocks the merge, and changes to the v3 frontend and to OpenSpec plans aren't checked at all. PR labels only cover `frontend`, `backend`, `devops`, `docs` and `dependencies`, so the v3 app, OpenSpec work, CI changes and tests can't be told apart in the PR list.

## What Changes

- **v3 frontend checks**: every PR that touches `v3/` runs the v3 workspace's lint, typecheck and Vitest suite.
- **OpenSpec checks**: every PR that touches `openspec/` or the OpenSpec workflow files under `.claude/` validates all specs and changes (and archived changes) strictly, and checks that the installed OpenSpec workflow files match the pinned OpenSpec version.
- **A report on the PR** for the v3 and OpenSpec checks, like the backend one: a single comment kept up to date for the latest commit, with test counts and the failing tests or findings, tagging the author only when something needs fixing.
- **Merge blocking**: backend tests, backend format, v3 checks and OpenSpec checks each report one always-present result check, which passes when the PR doesn't touch that area. The four become required checks on `main`, so a PR merges only when every check relevant to it passes. Turning that on is a repository setting that needs an admin; this change documents the exact setting.
- **Labels**: PRs get one label per part of the codebase they touch (`backend`, `frontend`, `frontend-v3`, `openspec`, `docs`, `cli`, `e2e`, `tests`, `ci`, `devops`, `dependencies`), a type label from the PR title (feature, bug, documentation, refactor, chore, ci, tests), and a size label from the lines changed.
- **Fixes the one check that fails today**: `v3/apps/student/public/sw.js` (the service worker) fails v3 lint because the `self` global isn't allowed there; it gets the same exemption the web workers already have.

Out of scope: backend lint, all Playwright end-to-end tests (`e2e/` and `v3/apps/student-e2e/` are never run or linted by these checks), and tests for the old `frontend/` app.

## Capabilities

### New Capabilities

- `ci/pr-checks`: which checks run on a pull request, what they report to the author, and when a pull request may be merged.
- `ci/pr-labels`: which labels a pull request gets automatically.

### Modified Capabilities

<!-- None: no existing spec covers CI. -->

## Impact

- **CI config**: new workflows for v3 checks, OpenSpec checks and their PR comment; a result job added to `backend-tests.yml` and `backend-format.yml` (no change to what they test); the backend comment workflow ignores runs where the backend wasn't touched; `labeler.yml` and `.github/labeler.yml` extended.
- **Code**: one ESLint config line in `v3/apps/student/eslint.config.mjs`. No backend code changes.
- **Repository settings** (admin, by hand): a ruleset on `main` requiring the four result checks.
- **Labels**: new labels created in the repository with consistent colours.
- **Contributors**: PRs that touch v3 or OpenSpec now take a few extra minutes of CI; a red check blocks merging once the setting is on.
