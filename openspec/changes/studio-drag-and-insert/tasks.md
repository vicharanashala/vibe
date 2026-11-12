# Tasks

All commands from `v3/`: `npx vitest run --root apps/student` and `npx tsc -b apps/student/tsconfig.app.json apps/student/tsconfig.spec.json`.

## 1. Shared arranging pieces

- [x] 1.1 Add pinned `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`, `@dnd-kit/modifiers` to the student app and verify install and typecheck pass
- [x] 1.2 Create `features/admin/arrange.tsx` (`SortableList`, `useSortableRow`, `DragHandle`, `positionFor`) with keyboard/touch/pointer sensors, vertical/parent modifiers, announcements and reduced-motion handling; verify unit tests for `positionFor` (up, down, edges, same place)
- [x] 1.3 Add `useMoveModule`, `useMoveSection` and optimistic reorder + rollback helpers in `features/admin/queries.ts`, and an optional position on `useCreateModule`/`useCreateSection`; verify by the tests in groups 2–3

## 2. Course outline

- [x] 2.1 Lessons: sortable rows with a drag handle and optimistic move with rollback toast; remove the arrow buttons; row menu gains Move up/Move down; verify keyboard-drag, menu move, rollback and same-place specs (update `studio-reorder.spec.tsx`)
- [x] 2.2 Sections and modules: sortable within their parent with handles, optimistic move and rollback; menu Move up/down; verify keyboard-drag specs asserting `beforeSectionId`/`afterModuleId` bodies
- [x] 2.3 Add above/below: row menus and hover "+" for lessons (type picker → editor with `after`/`before`), sections and modules (name dialog with position); "Add lesson" in empty sections; verify specs for each create body

## 3. Lesson editor

- [x] 3.1 Lesson route accepts `after`/`before` search params into `loc.position`, and creating a lesson sends `afterItemId`/`beforeItemId`; verify a spec that saving a new lesson from "Add below" posts the position
- [x] 3.2 Editor outline: sortable lessons with handles and a "⋯" menu per lesson (Add above, Add below, Move up, Move down) using the shared pieces; verify keyboard-drag, add-above/below and move specs in the editor outline

## 4. Integration check

- [x] 4.1 Run the full v3 suite, tsc, `NX_DAEMON=false npx nx run-many -t lint typecheck --projects=student --parallel=1` and `openspec validate --all --strict`; confirm all pass
- [x] 4.2 In the browser against the local stack as an instructor: drag a lesson, a section and a module with the mouse and confirm the order after reload; add a lesson below and above, and a section above; check keyboard drag and a tablet-width long-press; record the PR GIFs and screenshots
