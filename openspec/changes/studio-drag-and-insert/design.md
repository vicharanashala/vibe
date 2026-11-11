# Design

## Context

The motivation is in proposal.md, and the behaviour is in specs/v3/studio-content-arranging/spec.md.

**Today:**
- **Course outline:** `features/admin/course-content.tsx` renders modules → sections (collapsible) → lessons (loaded per section by `useSectionItems`). Lessons have up/down arrow buttons that call `useMoveItem` (`PUT …/items/{itemId}/move` with `beforeItemId` or `afterItemId`). Modules and sections can't be reordered.
- **Adding:** new lessons go through the lesson editor route (`/admin/courses/$c/$v/lesson?module&section&type`), whose save calls `POST …/sections/{sectionId}/items` without a position, so they land at the end.
- **Backend:**
  - Module and section create accept `afterModuleId`/`beforeModuleId` and `afterSectionId`/`beforeSectionId`.
  - Item create accepts `afterItemId`/`beforeItemId`.
  - `PUT …/modules/{moduleId}/move`, `PUT …/sections/{sectionId}/move` and the item move take the same pairs, within the same parent only.

## Goals / Non-Goals

**Goals:** drag-and-drop and insert-in-place at all three levels, accessible by keyboard and touch, one request per change, optimistic with rollback.

**Non-Goals:**
- Moving a lesson to another section, or a section to another module (the backend move endpoints keep the parent).
- Multi-select drag.
- Any backend change.

## Decisions

### 1. dnd-kit (`@dnd-kit/core` + `@dnd-kit/sortable`)
It has pointer, touch (activation delay) and keyboard sensors with screen-reader announcements built in, sortable lists per container, auto-scroll, and `restrictToVerticalAxis`/`restrictToParentElement` modifiers.

Rejected:
- Native HTML drag-and-drop: no touch support and poor keyboard support.
- Framer `Reorder`: no keyboard sensor or announcements.

Versions are pinned exactly.

### 2. One sortable list per container, shared row primitives
A small module, `features/admin/arrange.tsx`, exports:
- `SortableList`: a DndContext and SortableContext with sensors (Pointer with 6px distance, Touch with a 250ms delay, Keyboard with sortable coordinates), the vertical/parent modifiers, and announcements built from item names.
- `useSortableRow`: the handle props, transform/transition, and an `isDragging` style.
- `DragHandle`: a shadcn Button with a grip icon, labelled "Drag to reorder <name>".
- `positionFor(list, from, to)`: turns a drop into `{ beforeId }` or `{ afterId }`, relative to the neighbour at the destination. Moving down places it after the item now at `to`; moving up places it before that item. Its unit tests cover both directions and the edges.

Lessons, sections and modules each use one list; the editor outline uses the same pieces. Nested lists are separate DndContexts, so a drag never crosses parents. That matches the backend limit.

### 3. Optimistic order with rollback
- **On drop:** reorder the cached data immediately (`setQueryData` on `sectionItems` for lessons; on the course version for sections and modules), send the move, and invalidate on settle.
- **On error:** restore the snapshot and show a sonner toast ("The lesson wasn't moved: <reason>").
- **While saving:** a move already in flight ignores new drops at that level, so the orders never interleave.
- **New hooks:** `useMoveModule` and `useMoveSection` sit beside `useMoveItem` with the same shape. Create hooks gain an optional `position`.

### 4. Insert in place
- **Row menu:** each row's "⋯" menu gains Add above, Add below, Move up and Move down.
- **Hover "+":** a "+" button sits in the row's left gutter, shown on hover and focus-within and always on touch screens. It adds below.
- **Lessons:** Add opens the existing type picker, then navigates to the lesson editor with `after=<id>` or `before=<id>` search params. The route passes them as `loc.position`, and the create call sends `afterItemId`/`beforeItemId`. An empty section shows "Add lesson" at the top.
- **Sections and modules:** Add opens the existing name dialog, which now carries the position into create.

### 5. Motion and reduced motion
dnd-kit's transforms carry a short transition (the `easeOut` timing from `lib/motion.ts`). Under reduced motion, transitions are disabled and the drop happens without animation. The drop indicator is the dragged row's placeholder outline, plus a `ring` on the drop target.

## Risks / Trade-offs

- **[Risk] Drag handles inside collapsible headers clash with the expand trigger** → The handle is its own button, and the collapse trigger is unchanged.
- **[Risk] jsdom can't test pointer dragging** → Tests use the keyboard sensor (same code path to `onDragEnd`) and the menu fallbacks. Pointer and touch dragging are checked in the browser end-to-end run.
- **[Risk] A new lesson's position becomes wrong if the anchor lesson is deleted while the editor is open** → The backend rejects an unknown anchor, so the save error says so and the teacher can save again from the outline. This is rare and acceptable.

## Migration Plan

Frontend-only. Ship with `deploy-frontend-v3`; rollback is a redeploy.
