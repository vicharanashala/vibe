# Tasks

## 1. Make v3 lint pass

- [x] 1.1 Add `public/sw.js` to the worker override in `v3/apps/student/eslint.config.mjs`; verify `NX_DAEMON=false npx nx run-many -t lint typecheck --projects=student,api,proctoring` passes from `v3/` (no Playwright project included), and `npx vitest run --root apps/student` and `npx tsc -b apps/student/tsconfig.app.json apps/student/tsconfig.spec.json` still pass

## 2. v3 and OpenSpec checks

- [x] 2.1 Add `.github/workflows/v3-checks.yml` ("v3 Frontend Checks"): `changes` → `checks` (install, nx lint + typecheck, Vitest with JUnit, upload `v3-check-results` with step statuses and PR number) → `v3-checks-result` that always runs; verify with `actionlint` (or a YAML parse plus a dry read-through) and by running its check commands locally from a clean `v3/` install
- [x] 2.2 Add `.github/workflows/openspec-checks.yml` ("OpenSpec Checks"): `changes` → `checks` (pinned OpenSpec CLI, `validate --all --strict --json`, `validate --archived --strict --json`, `openspec update --force` then `git diff --exit-code -- .claude/`, upload `openspec-check-results`) → `openspec-checks-result`; verify locally that the same commands pass on this branch and that a hand-edited `.claude/skills/openspec-explore/SKILL.md` and a scenario-less requirement each make them fail

## 3. PR report comment

- [x] 3.1 Add `.github/scripts/pr-checks-comment.js` (builds the comment from downloaded artifacts: per-check status, JUnit counts, up to 30 failures, OpenSpec findings, author mention only on failure, untrusted text sanitised) with `node:test` tests in `.github/scripts/pr-checks-comment.test.js` covering all-pass, a failing test, a lint-only failure, an OpenSpec finding, and hostile text (mentions, backticks, HTML) in a failure message; verify with `node --test '.github/scripts/*.test.js'`
- [x] 3.2 Add `.github/workflows/pr-checks-comment.yml` on `workflow_run` for both workflows (default-branch context, no PR checkout): collect both runs for the head sha, download artifacts, confirm the PR number matches the head sha, run the script, create or update the `<!-- pr-checks-report -->` comment; verify with a YAML check and a read-through against `backend-tests-comment.yml`'s safety steps

## 4. Backend result checks

- [x] 4.1 In `backend-tests.yml` and `backend-format.yml`, replace the `pull_request` `paths:` filter with a `changes` job using the same paths, gate the existing job on it, add `backend-tests-result` / `backend-format-result` jobs that always run, and rely on the missing results artifact to show a check didn't run; keep `push` and `workflow_dispatch` running the tests unconditionally; verify with a YAML check and a diff showing the test and format steps themselves unchanged
- [x] 4.2 Make `backend-tests-comment.yml` treat a completed run with no results artifact as not run, and post nothing when neither backend check ran; verify by simulating the collect step for both cases

## 5. Labels

- [x] 5.1 Add `.github/scripts/pr-labels.js` (type label from a conventional title prefix with optional scope and `!`; size label from additions + deletions excluding lockfiles and `.claude/` OpenSpec files; both families kept to one label) with `node:test` tests for every spec scenario; verify with `node --test '.github/scripts/*.test.js'`
- [x] 5.2 Extend `.github/labeler.yml` (`frontend-v3`, `openspec`, `cli`, `e2e`, `ci`, `tests`, wider `docs`, `devops` and `dependencies`), add the `edited` event and a `github-script` step calling `pr-labels.js` in `labeler.yml`, and create the new labels with fixed colours via `gh label create`; verify the globs against this branch's changed files with a small script, and `gh label list` shows every label

## 6. Try it on GitHub

- [ ] 6.1 Open this branch as a draft PR; verify all four `result` checks report, the v3 and OpenSpec checks run (this PR touches both), the backend ones pass without running, the PR comment appears without mentioning the author, and the labels match (`frontend-v3`, `openspec`, `ci`, `devops`, `tests`, a type and a size)
- [ ] 6.2 Push a temporary commit that breaks one v3 test; verify the v3 result fails, the comment lists that test and mentions the author, then revert the commit and verify the comment returns to passing

## 7. Require the checks (repository admin)

- [x] 7.1 Write the admin instructions into the PR description: the ruleset (target `main`, require status checks `backend-tests-result`, `backend-format-result`, `v3-checks-result`, `openspec-checks-result` from GitHub Actions, "require up to date" off), the matching `gh api` command, and how to confirm on a PR that a failing result shows "Merging is blocked"; verify the command's JSON against GitHub's rulesets API schema

## Workflow follow-up

- An admin applies the ruleset after this PR merges, then confirms a failing check blocks a test PR.
- Archive the change after the PR merges.
