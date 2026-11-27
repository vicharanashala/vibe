# Proposal

## Why

When a teacher turns linear progression off for a course, the backend lets students open lessons in any order, but the v3 student app still forced strict mode to go one lesson at a time ("Finish the earlier lessons first"). It never read the course setting, which contradicts the study-mode spec ("lessons in order when the course has linear progression on").

## What Changes

- Strict mode in v3 reads the course's linear-progression setting. With it on (or unset, as the backend treats it), unreached lessons stay locked as today. With it off, any lesson opens in strict mode, with proctoring and progress tracking as normal.
- Instructor content locks still apply either way.
- While the setting loads, neither the lesson nor the locked screen is shown.
- Course-wide only. Module- and section-level linear progression is out of scope for now.

## Capabilities

### New Capabilities
<!-- None. -->

### Modified Capabilities
- `v3/study-mode`: "Strict mode keeps today's rules" gains scenarios for linear progression off, on and unset.

## Impact

- v3 only: `features/learn/lesson-page.tsx` (GreenGate) and a new `features/learn/linear-progression.ts` helper. No backend change.
