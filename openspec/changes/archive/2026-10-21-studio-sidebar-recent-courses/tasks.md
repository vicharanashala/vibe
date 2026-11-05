# Tasks

## 1. Setup

- [x] 1.1 Install v3 dependencies in this worktree (`pnpm install --frozen-lockfile` from `v3/`) and verify the existing suite passes with `npx vitest run --root apps/student`

## 2. Recent-course history

- [x] 2.1 Add `features/admin/recent-courses.ts`: read, record and subscribe to a per-user history in localStorage (`studio:recent-courses:<uid>`, newest first, no duplicates, capped at 10, try/catch on every access so blocked or corrupt storage reads as empty), exposed as `useRecentCourses()` via `useSyncExternalStore` plus a `storage` listener; verify with a new `recent-courses.spec.ts` covering ordering, moving a re-opened course to the top, the cap, per-user separation, and corrupt or blocked storage
- [x] 2.2 Add `useRecordCourseVisit(courseId, versionId)` and call it from the course detail page and the lesson editor page; verify with tests that opening a course page and a lesson editor each put that course first, and that switching tabs within a course doesn't add entries

## 3. Sidebar

- [x] 3.1 Under Courses in the studio sidebar, render up to 5 recent courses that appear in `useStudioCourses()` as shadcn `SidebarMenuSub` items (compact rounded `GeneratedCover` plus a truncated name, list labelled "Recent courses", `isActive` on the open course), falling back to the 5 newest courses when there is no usable history; verify with tests for the order, the fallback, a course missing from the user's list being skipped, a non-admin teacher seeing only taught courses, the current course marked current, and selecting an entry opening its course page
- [x] 3.2 Check the sidebar in the browser on desktop (light and dark) with long course names: rows truncate with an ellipsis and nothing overflows; confirm the phone layout is unchanged

## 4. Checks

- [x] 4.1 Run the full suite and the build typecheck from `v3/` and confirm both pass: `npx vitest run --root apps/student` and `npx tsc -b apps/student/tsconfig.app.json apps/student/tsconfig.spec.json`
