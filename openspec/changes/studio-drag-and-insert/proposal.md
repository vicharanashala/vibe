# Proposal

## Why

Arranging a course in ViBe Studio is slow:
- A new lesson always lands at the end of its section, so the teacher then clicks the up/down arrows once per place to move it where it belongs.
- Sections and modules can't be reordered from Studio at all.

The user asked for drag-and-drop and for adding directly above or below an existing item, the way Notion does.

## What Changes

- **Drag to reorder** in the Studio course outline:
  - lessons within their section
  - sections within their module
  - modules within the course

  Each row has a grip handle, a drop indicator, and smooth movement. The new order shows at once and is saved with one request per drop. A failed save puts the old order back and says why.
- **Keyboard and touch:**
  - keyboard: focus the handle, Space or Enter to pick up, arrow keys to move, Space to drop, Escape to cancel, with screen-reader announcements
  - touch: long-press to drag on tablets
- **Add in place:**
  - a "+" on hover or focus adds directly below a row
  - each row's "⋯" menu offers Add above, Add below, Move up and Move down
  - an empty section offers "Add lesson" at the top

  New lessons, sections and modules are created at that position. A lesson started from "Add above/below" keeps its position through the lesson editor.
- **Removed:** the always-visible up/down arrow buttons. Move up/down stays available in the row menu.
- **Lesson editor outline:** the left sidebar gets the same drag and add-in-place for lessons in each section.

## Capabilities

### New Capabilities
- `v3/studio-content-arranging`: how teachers order and insert modules, sections and lessons in ViBe Studio.

### Modified Capabilities
<!-- None -->

## Impact

- **v3 only;** the backend already accepts positions on create (`afterItemId`/`beforeItemId`, `afterSectionId`/`beforeSectionId`, `afterModuleId`/`beforeModuleId`) and has move endpoints for all three levels.
- **Files:** `features/admin/course-content.tsx`, `features/admin/queries.ts` (move/create hooks), `features/admin/editor/editor-outline.tsx`, `features/admin/editor/lesson-api.ts` (create at a position), `router.tsx` (lesson route `after`/`before` search params).
- **New dependency:** `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`, `@dnd-kit/modifiers`, pinned to exact versions.
- **Limit:** lessons move only within their section, and sections within their module, because the backend's move endpoints don't change the parent.
