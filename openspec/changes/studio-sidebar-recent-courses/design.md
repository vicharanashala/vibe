# Design

## Context

The studio sidebar (`StudioChrome` in `features/admin/admin-shell.tsx`) renders nav groups through `StudioNav`, a flat `SidebarMenu`. The course list for the signed-in user already comes from `useStudioCourses()` (every course for admins, the courses they teach otherwise), cached by React Query and shared with Studio Home and the Courses page. Courses have no logo or image field; the studio shows each course with `GeneratedCover` (marble art seeded by the course id, with its initials), and that is the "logo" here.

Courses open at `/admin/courses/$courseId/$versionId` (inside the sidebar shell) and lesson editors at `/admin/courses/$courseId/$versionId/lesson` (full-screen, no sidebar). Nothing records which courses a user opens, and v3 cannot add backend storage.

## Goals / Non-Goals

**Goals:**
- Recent courses appear under Courses as sub-items, at most 5, updating as soon as a course is opened.
- One small, testable module owns the history: reading, recording, ordering, trimming.

**Non-Goals:**
- Syncing history across browsers or devices (needs a backend).
- Showing recent courses on phones (the studio's phone tab bar has no room for them).
- Pinning, removing, or reordering recent courses by hand.

## Decisions

**Store the history in `localStorage`, keyed by the user's Firebase uid** (`studio:recent-courses:<uid>`), as a JSON list of `{ courseId, versionId, at }`, newest first, capped at 10 entries. Ten rather than five so that when a course disappears from the user's list (see filtering), older entries can fill its place. Alternatives: a backend field (ruled out: v3 is frontend-only); sessionStorage (loses history on every new tab, defeating the point). Reads and writes are wrapped in try/catch, as `DesktopHint` and the theme provider already do, so blocked or corrupt storage reads as an empty history.

**Store ids, not names.** Names and access come from `useStudioCourses()` at render time, so a renamed course shows its new name and a course the user can no longer see drops out automatically. The `versionId` stored is the one the user opened, so selecting the entry returns them to the same version.

**A `useSyncExternalStore` hook (`useRecentCourses`) with an in-module listener set**, so recording a visit on the course page re-renders the sidebar in the same tab immediately; a `storage` event listener keeps other tabs in step. Alternative: React context state, which would need a provider and still persist separately.

**Record visits in the two route components** (the course detail page and the lesson editor page) with a `useRecordCourseVisit(courseId, versionId)` effect that runs when the ids change, not on every tab switch within a course.

**Render as shadcn `SidebarMenuSub` items under Courses**, each a `SidebarMenuSubButton` link with a 24 px rounded `GeneratedCover` (compact; 20 px left its initials unreadable) and the name truncated with an ellipsis. Use `isActive` for the open course, and give the list an accessible label ("Recent courses"). The fallback (no history) uses the same rows with the 5 newest courses, so the sidebar looks the same either way.

## Risks / Trade-offs

- [History is per device] → stated in the proposal; acceptable for a navigation shortcut.
- [The 5 rows push "People" lower in the sidebar] → each row is a compact sub-item (about 28 px), so the whole list adds roughly 140 px.
- [Admins with thousands of courses] → only a lookup by id into the already-loaded list; no extra requests.
