# CLAUDE.md

## Local dev stack persistence

The local dev stack (Mongo replica set + Firebase Auth emulator) is
persisted across restarts:

- Mongo `dbpath` is moved to `~/.local/share/vibe/mongo/dbpath` (so
  data survives reboots that wipe `/tmp`).
- Auth emulator `--import` loads the saved users from
  `~/.local/share/vibe/auth-export` on startup, so the seeded
  `admin@yaksha.com` / `teacher@yaksha.com` / `user@yaksha.com`
  accounts persist.
- A shutdown trap (`vibe_shutdown` in `run.sh`) runs
  `firebase emulators:export` before the backend is killed, so
  any new signups made during the session are saved for the next
  run.

These three local-dev workarounds are tagged with the conventional
`[local-dev]` scope on their commits and live only on the
`local-dev` branch — they are NEVER pushed.

## Backend module pattern

Each feature module under `backend/src/modules/` follows:

```
moduleName/
  classes/         # DTOs, validators
  controllers/     # @JsonController endpoints
  cron/            # node-cron scheduled jobs (optional)
  repositories/providers/mongodb/   # Mongo CRUD
  services/        # business logic
  utils/           # pure functions (preferred for testability)
  container.ts     # inversify bindings
  index.ts         # auto-discovery export (peerReviewContainerModules + peerReviewModuleControllers)
  types.ts         # TYPES symbols
```

The auto-discovery in `backend/src/bootstrap/loadModules.ts`
imports `peerReviewContainerModules` and `peerReviewModuleControllers`
from each module's `index.ts`. New modules must export both.

### Modules in this repo

- `auth` — Firebase auth wrapper
- `users`
- `courses`
- `notifications`
- `auditTrails`
- `anomalies`
- `ejectionPolicy`
- `invites`
- `hpSystem` — the legacy "HP" module
- `peerReview` — v1 peer-based review system (Phase 1-6)

### peerReview specifics

The peerReview module adds 4 new collections
(`peer_review_assessments`, `peer_review_submissions`,
`peer_review_assignments`, `peer_review_reviews`), 1 new
ItemType (`PEER_REVIEW_ASSESSMENT`), 1 new AuditCategory
(`PEER_REVIEW`), 1 new audit-trail context field, and 3
scheduled crons (AssignmentRunner, ReassignmentRunner,
FinalizationRunner). See
`backend/src/modules/peerReview/README.md` and
`docs/docs/contributing/conventions/peer-review.mdx` for the
detailed convention.

## Branching model

- `main` = upstream, clean. Never has your local hacks. Always
  fast-forwards.
- `local-dev` = `main` + 3 `[local-dev]`-tagged commits that make
  your laptop run. NEVER push this branch anywhere.
- `feat/*` = your real work. Branched from `local-dev`, rebased
  onto `main`, pushed to origin (your fork).

When you make a feature PR, the trap: `feat/*` was born from
`local-dev`, so it carries the 3 `[local-dev]` commits in its
history. If you `git push origin feat/something` and open a PR
against upstream/main, the PR diff will include those 3 commits.

Fix: before pushing the PR branch, rebase it onto clean main:
```bash
git checkout feat/something-cool
git rebase main
git push --force-with-lease
```

Now the PR diff only shows your actual feature work, not the
local hacks.

## Commit format

Conventional Commits: `<type>(<scope>): <subject>`

`<type>` is one of: `feat`, `fix`, `doc`, `style`, `refactor`,
`test`, `chore`, `perf`.

For the peer-review work, the scope is `peer-review` (e.g.
`feat(peer-review): add assignReviewers algorithm`).

For local-dev-only commits, the scope tag is `[local-dev]`
(e.g. `chore(dev): [local-dev] persist run.sh stack`).

## What is "good enough to commit"

A commit is good when:
- The unit tests pass for the changed file(s)
- `pnpm eslint` is clean (or the file is in `.eslintignore`)
- The change is logically atomic (one logical change per commit)
- The commit message explains WHY, not just WHAT
- The user has approved the commit
