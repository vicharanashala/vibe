# ViBe v3

Nx monorepo for the new ViBe frontend. It currently holds the student app and its shared packages:

| Project | Path | What it is |
|---|---|---|
| `student` | `apps/student` | Student-facing web app (Vite + React 19 + TypeScript) |
| `student-e2e` | `apps/student-e2e` | Playwright end-to-end tests for `student` |
| `api` | `packages/api` | Typed client for the ViBe backend, generated from its OpenAPI spec |
| `proctoring` | `packages/proctoring` | Proctoring engine ported from the current frontend (camera checks so far) |

## Stack

- **Build:** Vite, managed by Nx. Node 24 + pnpm.
- **UI:** shadcn (Base UI primitives) with the StyleUI **notio** theme, **sunny** colour scheme, Tailwind CSS v4.
- **Fonts:** Aleo for headings (self-hosted via `@fontsource-variable/aleo`); the system sans stack for body text.
- **Theme:** light by default, with a light/dark toggle (small custom provider in `components/theme-provider.tsx`).
- **Tests:** Vitest + React Testing Library (unit/component); Playwright (e2e).

## Student app so far

Landing page · log in / sign up / forgot password (Firebase) · onboarding (name,
camera + microphone check) · home (continue learning, getting-started checklist) ·
my courses (active/archived, search) · course page (syllabus, progress, consent
status) · profile (name, password, theme, log out). Design follows Uxcel (~95%)
with small Luma touches, on the notio/sunny theme.

## Local backend

The app runs against the real ViBe backend, unmodified, with the Firebase Auth
emulator and a separate `vibe_v3_local` database. See
[`tools/local-api/README.md`](tools/local-api/README.md).

## Commands

```sh
pnpm install
tools/local-api/start.sh   # local backend + auth emulator (see tools/local-api)
node tools/local-api/seed.mjs
pnpm nx dev student        # dev server on http://localhost:4300
pnpm nx run-many -t test   # Vitest, all projects
pnpm nx lint student
pnpm nx typecheck student
pnpm nx build student      # output: apps/student/dist
pnpm nx e2e student-e2e    # Playwright
```

Add shadcn components from `apps/student`, e.g. `pnpm dlx shadcn@latest add <component>`.
