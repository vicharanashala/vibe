# Proposal

## Why

In ViBe Studio the sidebar's **Courses** item only opens the full course list, so getting back to a course you were just working on takes two clicks and a search every time. Teachers and admins usually move between the same few courses; the sidebar should take them straight there.

## What Changes

- Under **Courses** in the studio sidebar, list up to 5 courses the signed-in user opened most recently, newest first, each with its course cover (the generated cover art with the course's initials that the studio already uses as a course's logo) and its name.
- Selecting one opens that course in the studio; the course currently open is highlighted.
- Opening a course in the studio (its course page or one of its lesson editors) records it as recently opened.
- Before the user has opened any course on this device, the list shows their 5 newest courses instead, so the sidebar is never empty for someone who has courses.
- Courses the user can no longer see in the studio (deleted, or no longer teaching) are left out.
- Applies to the desktop sidebar. The phone tab bar is unchanged.

## Capabilities

### New Capabilities

- `v3/studio-navigation`: how people move around ViBe Studio's sidebar, starting with quick access to recently opened courses.

### Modified Capabilities

<!-- None: there are no existing specs. -->

## Impact

- **Code**: v3 student app only: the studio shell's sidebar (`features/admin/admin-shell.tsx`), the course detail page and lesson editor shell (recording a visit), plus a small hook for the recent-course history and its tests.
- **Data**: no backend changes. The history is stored in the browser, per user and per device; it does not follow the user to another browser or device. Course names and access come from the course list the studio already loads.
- **Dependencies**: none new.
