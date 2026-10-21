# Design

## Context

Today's CI on pull requests (`.github/workflows/`):

- `backend-tests.yml` runs the backend Vitest suite (excluding a known-broken list) when `backend/**` or `pnpm-lock.yaml` changes, and uploads JUnit results plus the PR number.
- `backend-format.yml` checks changed backend lines against Prettier, under the same kind of `paths:` filter.
- `backend-tests-comment.yml` runs on `workflow_run` from the default branch, downloads those artifacts, compares failures with the latest `main` run, and keeps one marker comment on the PR, mentioning the author only when something fails. It never checks out PR code, so it's safe for fork PRs.
- `labeler.yml` runs `actions/labeler@v5` on `pull_request_target` (opened, reopened, synchronize) with `sync-labels: true`, plus a `revert` label from the title.

`main` has no required status checks (rulesets only cover linear history and deletion). The account used for this work can push but isn't a repository admin.

v3 is its own pnpm workspace (`v3/pnpm-lock.yaml`, pnpm 11, Node 22, as in `deploy-frontend-v3.yml`) with Nx projects `student`, `api`, `proctoring` and `student-e2e`. On the current `main`, `nx run-many -t lint typecheck` fails only on `student:lint`: six `no-restricted-globals` errors for `self` in `apps/student/public/sw.js`. Vitest (190 tests) and `tsc -b` pass. `openspec validate --all --strict` and `--archived` pass.

## Goals / Non-Goals

**Goals:**
- A PR touching v3 or OpenSpec gets the same treatment backend PRs get: checks, a kept-up-to-date comment, and an author mention on failure.
- Four required checks that every PR reports, so required checks never sit "expected" forever on unrelated PRs.
- Richer, accurate labels that update as the PR changes.

**Non-Goals:**
- Backend lint (deferred by request).
- Any Playwright tests: the v3 `student-e2e` project and the root `e2e/` package are not run, linted or typechecked by these checks (they need a running backend and Firebase emulator).
- Changing what the backend tests or format check verify, or the backend comment's content.
- Comparing v3 failures with a `main` baseline: the v3 suite is fully green, so every failure belongs to the PR.

## Decisions

**Path detection inside the workflow, not `on.paths`, with a result job that always runs.** A required check that a `paths:` filter skips never reports, and GitHub then blocks the PR waiting for it. Each area workflow therefore triggers on every `pull_request` to `main` and has three jobs:

```
changes (git diff base..head, sets an output)
   |
   +-- checks (only if changed: the real work)
   |
   +-- result (always: fails if checks failed or were cancelled; passes if they passed or were skipped)
```

The required checks are the four `result` jobs: `backend-tests-result`, `backend-format-result`, `v3-checks-result` and `openspec-checks-result`. Each job name is unique, so the required-check names are unambiguous. Detection uses `git diff --name-only` between the PR's base and head shas, with a full-history checkout. That avoids a third-party action with `pull-requests: read`. Alternative: `dorny/paths-filter`, which is one more dependency to pin and trust.

`backend-tests.yml` and `backend-format.yml` keep their current steps, behind the `changes` gate with the same path lists as today. Their `push` and `workflow_dispatch` triggers keep running the tests unconditionally. `backend-tests-comment.yml` already skips runs whose conclusion is `skipped`. Once the backend workflows run on every PR, their conclusion is `success` even when nothing ran. A skipped check uploads no artifact, so the comment workflow treats "completed, but no results artifact" as not run (no separate `ran` flag is needed), and posts nothing when neither backend check ran.

**v3 checks** (`v3-checks.yml`, workflow name "v3 Frontend Checks"):
- Install with `pnpm install --frozen-lockfile` in `v3/`.
- Run `nx run-many -t lint typecheck --projects=student,api,proctoring` with `NX_DAEMON=false NX_NO_CLOUD=true`. Listing projects explicitly keeps `student-e2e` (Playwright) out.
- Run `vitest run --root apps/student` with the default, `github-actions` and `junit` reporters. Lint and typecheck output go to log files.
- Upload the JUnit file, a per-step status file, and the PR number as the `v3-check-results` artifact, as the backend does.
- Triggers on `v3/**` and on the workflow file itself.

**OpenSpec checks** (`openspec-checks.yml`, "OpenSpec Checks"):
- Install `@fission-ai/openspec` at a pinned `OPENSPEC_VERSION` (1.14.3), with `OPENSPEC_TELEMETRY=0`.
- Run `openspec validate --all --strict --json` and `openspec validate --archived --strict --json`.
- Then run `openspec update --force` and `git diff --exit-code -- .claude/`, so hand-edited or stale workflow files fail with a hint to run `openspec update`.
- Triggers on `openspec/**`, `.claude/commands/opsx/**`, `.claude/skills/openspec-*/**` and the workflow file.
- Bumping OpenSpec is then a single PR that changes `OPENSPEC_VERSION` and the regenerated `.claude/` files together.

**One comment for v3 and OpenSpec** (`pr-checks-comment.yml`, marker `<!-- pr-checks-report -->`):
- Runs on `workflow_run` for both new workflows, from the default branch, with `pull-requests: write`, `actions: read` and `contents: read`. It never checks out PR code.
- It resolves the PR from the artifact's PR number, then confirms that PR's head sha matches the run, exactly like the backend comment.
- The comment has one section per check that ran:
  - v3: lint, typecheck and tests, each pass or fail; test counts parsed from JUnit; up to 30 failing tests with their first error line.
  - OpenSpec: each ERROR finding with its file.
- It mentions the author only on failure, and updates the existing comment in place.
- Untrusted artifact text is sanitised the same way the backend comment does it (single line, mentions and backticks neutralised, length-capped).
- The backend comment stays separate and unchanged. A shared script was considered, but would mean editing a working backend workflow for no user-visible gain.

**Lint fix:** add `public/sw.js` to the existing worker override in `v3/apps/student/eslint.config.mjs`, which already turns `no-restricted-globals` off for `public/workers/**/*.js`. The service worker, like web workers, has `self` as its global scope.

**Labels:**

Area labels and their file patterns (`.github/labeler.yml`, `any-glob-to-any-file`):

| Label | Patterns |
|---|---|
| `backend` | `backend/**` |
| `frontend` | `frontend/**` (the current web app) |
| `frontend-v3` | `v3/**` |
| `openspec` | `openspec/**`, `.claude/commands/opsx/**`, `.claude/skills/openspec-*/**` |
| `docs` | `docs/**`, `**/README.md` |
| `cli` | `cli/**` |
| `e2e` | `e2e/**`, `v3/apps/student-e2e/**` (label only; never run) |
| `tests` | `**/*.spec.*`, `**/*.test.*`, `**/test/**`, `**/tests/**`, `e2e/**`, `v3/apps/student-e2e/**` |
| `ci` | `.github/workflows/**`, `.github/scripts/**` |
| `devops` | `.github/**`, `.husky/**`, `self-hosting/**`, `scripts/**`, `firebase.json`, `.firebaserc` |
| `dependencies` | `**/package.json`, `pnpm-lock.yaml`, `v3/pnpm-lock.yaml`, `pnpm-workspace.yaml`, `v3/pnpm-workspace.yaml` |

- The existing `frontend`, `backend`, `docs`, `devops` and `dependencies` rules are extended to the patterns above; nothing else is removed.
- `labeler.yml` adds the `edited` event, so title changes re-label.
- After the labeler, a `github-script` step sets the type label and the size label. It removes any other label from the same family, so exactly one remains. Size counts additions plus deletions from the PR files API, excluding lockfiles and `.claude/` OpenSpec files.
- It runs on `pull_request_target`, like today, and never checks out PR code.
- `ci` and `tests` are both area labels (from files) and type labels (from `ci:` / `test:` titles). The script only ever adds those two; their removal is left to `actions/labeler`'s file matching. Otherwise a workflow PR titled `fix: …` would lose its `ci` area label. A `ci:`-titled PR that touches no CI files may see the label removed by the labeler and re-added by the script on each run: harmless, and rare.
- New labels are created once with fixed colours and a one-line description (`gh label create`): `frontend-v3`, `openspec`, `cli`, `e2e`, `ci`, `feature`, `bug`, `documentation`, `refactor`, `chore`, `size/XS`…`size/XL`. Existing `backend`, `frontend`, `docs`, `devops`, `tests` and `dependencies` are reused, with descriptions added. Unrelated existing labels (`AI`, `llm`, `quiz-grading`, …) are left alone.

**Making checks required:** a ruleset on the default branch requiring the four `result` checks from GitHub Actions. "Require branches to be up to date" stays off, to avoid rebase churn. This needs a repository admin. The tasks include the exact `gh api` call and the UI path, and a manual verification on a test PR.

## Risks / Trade-offs

- [Every PR now starts four workflows, even if most finish in seconds] → The `changes` jobs use a shallow-enough checkout and exit immediately. The cost is a few runner-seconds per PR.
- [A flaky v3 test now blocks merging] → The suite has been stable under normal load. The PR comment names the test so it can be re-run or fixed. Re-running the workflow from the PR is enough.
- [The `pull_request_target` labeler step reads PR data with a write token] → It only reads file names, line counts and the title through the API, and never executes PR code.
- [Required checks don't take effect until an admin applies the ruleset] → The checks and comments work without it. The ruleset is a documented manual step with a verification task.
- [Pinned OpenSpec version drifts behind local installs] → The drift check fails loudly with the fix (`openspec update` with the pinned version). Version bumps are deliberate PRs.
