# Proposal

## Why

Students go through every course in one of two modes. **Study mode** means watching and reading freely, on any device. **Strict mode** means proctored, on a PC, and it's the only mode that counts towards progress.

v3 already offers both, as "Study mode" and "Certified mode". Today the student picks, and teachers have no say. The backend's linear-progression lock also limits what study mode can open.

Teachers need two things:
- a way to take study mode away from specific content, so it can only be done in strict mode;
- study mode to work on phones without the linear lock.

Today the production app has no study mode at all. It simply blocks phones from proctored lessons.

## What Changes

**Teacher control**
- Teachers can turn study mode off for a module, a section, or a single item.
- Each level inherits from the level above (item, then section, then module) unless it is set itself. With nothing set, study mode is allowed.
- New and existing courses therefore stay fully open to study mode. Nothing changes until a teacher turns it off somewhere.

**Study mode (student)**
- Works on phones and PCs.
- No proctoring.
- Videos can be watched, rewatched and seeked freely, in any order, even when the course has linear progression on.
- Nothing is recorded as progress. Quizzes can't be attempted.
- Content where the teacher has turned study mode off shows "The instructor has disabled study mode for this module / section / item" and points the student to strict mode.

**Strict mode (student)**
- PC only. A phone sees a "continue on a computer" screen.
- Proctored with the resolved detectors, as today.
- Linear when the course's linear-progression setting is on.
- The only mode that records progress and the only mode where quizzes can be taken.
- This is v3's current "Certified mode", relabelled "Strict mode". Behaviour and stored choices are unchanged.

**Backend**
- An optional study-mode flag on modules, sections and items.
- Endpoints for teachers to set or clear it.
- The lesson read response says whether study mode is allowed for that item.
- A study-mode read that skips the linear-progression lock without touching progress.

**v3 Studio**
- Study-mode switches on modules, sections and items, with "inherited" shown when a level isn't set itself.
- Studio also stops overwriting the course's linear-progression setting with `false` when it saves.

**Production frontend**
- Teachers get the same switches in the course editor.
- On a phone, students can open videos where study mode is allowed, with no progress saved. Everything else keeps today's "use a computer" screen.
- On a PC, behaviour is unchanged.

No breaking changes:
- Content with no flag behaves exactly as today.
- Strict mode is today's certified flow.
- The new endpoints and response field are additive.

## Capabilities

### New Capabilities
- `backend/study-mode`: the per-module/section/item study-mode setting, its inheritance, the teacher endpoints, and study-mode lesson access that skips the linear lock and records nothing.
- `v3/study-mode`: how the v3 student app applies the study/strict split (devices, proctoring, progress, quizzes, linear order, the instructor-disabled notice) and the Studio switches.
- `frontend/study-mode`: the production frontend's teacher switches and phone study viewing.

### Modified Capabilities
None. The only existing spec is `v3/studio-navigation`, which this change doesn't affect.

## Impact

- **Backend:**
  - Changes the module, section and item models (`backend/src/shared/interfaces/models.ts`, `backend/src/modules/courses/classes/transformers`).
  - Adds a resolver next to `resolveProctoringDetectors`.
  - Adds teacher endpoints in the Module, Section and Item controllers, alongside the existing proctoring overrides.
  - Adds study-mode handling in `ItemService.readItem`.
  - No migration: an absent flag means "inherit", and the top level defaults to allowed.
- **v3:**
  - Student: `features/learn/tracks.ts`, `lesson-page.tsx`, `features/courses/course-page.tsx`, plus a new device check for strict mode.
  - Studio: `features/admin/course-content.tsx` and `course-proctoring.tsx` / `course-registration.tsx` (the linear `?? false` fix).
  - Following the project rule that v3 changes don't touch `backend/`, the backend part is its own PR and lands first. v3 depends on it.
- **Production frontend:**
  - `app/pages/teacher/teacher-course-page.tsx` and `hooks/hooks.ts` (teacher switches).
  - `app/pages/student/course-page.tsx` with `components/MobileFallbackScreen.tsx` (phone study viewing).
- **Not affected:** quizzes, proctoring detectors and anomaly handling, and the progress rules for strict mode.
