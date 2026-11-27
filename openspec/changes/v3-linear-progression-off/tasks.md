# Tasks

From `v3/`: `npx vitest run --root apps/student` and `npx tsc -b apps/student/tsconfig.app.json apps/student/tsconfig.spec.json`.

## 1. Strict mode honours the course setting

- [x] 1.1 Add `features/learn/linear-progression.ts` (`isLinearCourse`, unset = on; `isOrderLocked`) and use it in `GreenGate`, waiting for both the current path and the course settings before deciding; verify with `linear-progression.spec.tsx` (helper cases)
- [x] 1.2 Verify in the app with specs: linear off opens an unreached lesson and starts tracking; on and unset show "Finish the earlier lessons first"; an instructor-locked lesson stays locked when off; nothing flashes while the setting loads
- [x] 1.3 Confirm no other v3 surface derives order-based locks (the course outline links every lesson; other locked screens come from backend refusals, which only happen when linear is on); verify the existing lesson, tracks, quiz and proctoring specs still pass
