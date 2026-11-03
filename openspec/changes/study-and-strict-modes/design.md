# Design

## Context

See proposal.md for the why, and the three specs for the behaviour. What exists today and shapes the approach:

**Per-node overrides**
- Per-node proctoring overrides already follow the pattern this design copies.
- `proctoringDetectors?: … | null` sits on items and modules, resolved by `resolveProctoringDetectors` (item, then module, then course) in `backend/src/shared/interfaces/models.ts:369`.
- They're set through `PUT …/items/{id}/proctoring` and `PUT …/modules/{id}/proctoring`.
- Sections have no per-node settings at all.

**Linear progression**
- Enforced in four backend places, all reading only the course flag:
  - `ItemService.readItem` (`:640-736`), which also moves the progress pointer when the previous item is complete;
  - `attemptAbilities`;
  - `ProgressService` start/stop;
  - `itemAbilities` (not applied to readItem).

**v3**
- Has frontend-only tracks (`features/learn/tracks.ts`): `blue` (Study) and `green` (Certified).
- Blue already saves no progress and blocks quizzes. It still requires the camera, and it reads lessons through the normal `readItem`.
- So blue is limited by the linear lock, and opening the current-plus-one item in blue can move the strict pointer. That's an existing side effect this change removes.
- v3 has no phone blocking.

**Production frontend**
- Blocks phones (under 768px wide) unless every resolved detector is off (`course-page.tsx:1811`). It has no study mode.

**Generated API types**
- Both frontends use typed API clients generated from the backend OpenAPI spec:
  - `frontend`: `pnpm copy && pnpm gen-schema`
  - v3: `pnpm --filter @vibe/api generate`

## Goals / Non-Goals

**Goals:**
- One backend notion, "is study mode allowed for this item", that both frontends read.
- Study mode can't change strict progress in any way.
- Anything without a setting behaves as it does today.

**Non-Goals:**
- Server-side device detection. "PC only" is enforced in the apps, as decided with the user.
- A course-level study-mode switch. Teachers turn it off per module, section or item. A course-wide default can be added later as the top tier of the same resolver.
- Changing strict-mode progress rules, proctoring detectors, quiz attempt rules or the watch-time rule.
- A study mode on production *desktop*. On a computer the production app stays strict-only. Study mode there is phone-only (spec `frontend/study-mode`).
- Server-side enforcement of free seeking or replay limits. None exist today. Study mode simply doesn't apply the client restrictions.

## Decisions

### 1. A nullable boolean `studyModeEnabled` on module, section and item

`studyModeEnabled?: boolean | null`:
- `true` means allowed;
- `false` means disallowed;
- `null` or absent means inherit.

It's stored on the module and section subdocuments in the course version, and on the item documents.

A new `resolveStudyMode(item, section, module)` sits next to `resolveProctoringDetectors`. It returns `{ allowed, source: 'item' | 'section' | 'module' | 'default' }`. The `source` lets the apps name the level that disabled it. The check is `!= null`, for the same Mongo `null` reason documented on the detector resolver.

*Alternatives:*
- **A mode enum (`'study' | 'strict'`) per node.** It reads like the user's wording, but the only teacher action is "turn study off". An enum invites a third value and the same nullable handling.
- **Reusing `proctoringDetectors` (all off means study).** That would mix two settings: a teacher can't then have a proctored strict video that's also viewable in study mode.

### 2. Sections get their first per-node setting

Section is a subdocument of module, inside the version document. The section endpoint updates the version document the way `SectionService` edits do now, so no new collection or migration is needed.

Copy and transfer of a version (`CourseVersionService`, `CourseTransferService`) carry the field. That's automatic for the subdocuments, but the copy code builds new item objects, so the item copy needs the field added explicitly.

### 3. Teacher endpoints copy the proctoring override endpoints

The new endpoints, each taking `{ studyModeEnabled: boolean | null }`:
- `PUT /courses/versions/:versionId/modules/:moduleId/study-mode`
- `PUT /courses/versions/:versionId/modules/:moduleId/sections/:sectionId/study-mode`
- `PUT /courses/versions/:versionId/items/:itemId/study-mode`

Each uses the same `CourseVersionActions.Modify` ability check as the proctoring endpoints, so the permission rule is identical and already tested.

### 4. Study reads are a flag on the existing lesson read

The existing `GET` that calls `ItemService.readItem` accepts `?mode=study`. With it, `readItem`:
1. checks enrollment as usual;
2. rejects a `QUIZ` with 403 `STUDY_MODE_QUIZ`;
3. resolves study mode and rejects a disallowed item with 403 `STUDY_MODE_DISABLED`, including `source`;
4. returns the item, skipping the linear-progression block **and the progress-pointer update** (`:715-731`).

Without `mode=study`, the code path is untouched. Every response adds `studyMode: { allowed, source }`.

The apps need to tell these apart from a linear-lock 403 without matching text. `HttpErrorHandler` (`backend/src/shared/middleware/errorHandler.ts`) already sends `error.name` in the `ErrorResponse`, but nothing else. So:
- add a `StudyModeError extends HttpError(403)` whose `name` is the code (`STUDY_MODE_DISABLED` / `STUDY_MODE_QUIZ`) and which carries `details: { source }`;
- extend the handler's plain-`HttpError` branch to pass `details` through when an error has it. Every existing error has no `details`, so their responses are unchanged.

*Alternatives:*
- **A separate study endpoint.** It would duplicate enrollment, cohort and hidden-item handling, which is where readItem's complexity lives.
- **Lifting linear for study-allowed items in the normal read.** That would change strict behaviour and break "no breaking changes".

*Why skipping the pointer matters:* v3's blue track would otherwise keep advancing strict progress. That's an existing leak this decision closes.

### 5. v3 keeps the track ids and changes labels and rules

`blue` and `green` stay as ids, so saved choices and links keep working. Only the labels change, to Study and Strict. Blue lessons call the read with `mode=study`:
- the outline drops the linear lock in blue (`course-page.tsx:312`);
- a 403 with a study-mode code shows the instructor-disabled notice with a "Switch to strict mode" action;
- the camera requirement in blue is removed ("no proctoring").

Green adds a device gate. The check is `matchMedia('(pointer: coarse)')`, the primary-input test: phones and tablets match, touchscreen laptops don't. It's wrapped in one hook so tests can stub it. The production app's 768px width check isn't reused, because a narrow desktop window isn't a phone.

### 6. Production frontend: phone study viewing hooks into the existing phone branch

At `course-page.tsx:1811`, before `MobileFallbackScreen`, if the item is a video and the read response says study mode is allowed, the page renders the video in study mode:
- fetched with `mode=study`;
- no proctoring components;
- no start/stop progress calls;
- seek allowed;
- with a banner.

Otherwise `MobileFallbackScreen` shows, now with an optional line naming the level that disabled study mode.

The existing "all detectors off opens on a phone with progress" path is kept unchanged (spec scenario "Unproctored item on a phone"), so no teacher setup that works today breaks.

Because the student page reads the item normally first, a phone makes two requests for a study-mode video. That's acceptable. The alternative, a phone-only read that always asks for study first, would lose the existing unproctored path.

### 7. Teacher UI placement

- **Production:** a three-way select (On / Off / Inherit) in the selected-entity side panel of `teacher-course-page.tsx`, next to the proctoring override panels (`:2966-3120`). Mutations go in `hooks/hooks.ts`, modelled on `useUpdateItemProctoring`.
- **v3 Studio:** the same three-way choice as a shadcn `Select` in the module/section/item menus of `features/admin/course-content.tsx`, with an "Inherited" badge.
- **Fix:** the `?? false` linear defaults in `course-proctoring.tsx:56-57` and `course-registration.tsx:182-183` become `?? true`, to match the backend.

## Risks / Trade-offs

- **Phone detection is client-side, so a student can spoof a desktop.** → This is by decision, and the impact is limited: the student still gets the full strict flow with proctoring. Spoofing only gets them the same thing a PC would.
- **Study reads expose not-yet-reached videos.** → That's intended. Quizzes and items where study mode is disallowed are refused server-side, and nothing is recorded.
- **Removing the camera in blue changes current v3 study behaviour.** → The user asked for study mode to have no proctoring. Nothing was detected or reported in blue anyway.
- **Production: 768px width check versus coarse pointer.** → The production app keeps its existing width check, to avoid changing who sees the phone screen today. Only v3 uses the pointer check.
- **Extra round trip on production phones.** → Only for phones opening a video. See decision 6.
- **The error handler change touches every error response.** → `details` is only added when present. A test asserts that an existing `HttpError` response body is unchanged.

## Migration Plan

- **Order:** backend PR first (data, endpoints, read flag, regenerated OpenAPI), then the v3 PR and the production frontend PR, each regenerating its API types.
- **No data migration:** absent means inherit means allowed.
- **Rollback:**
  - Reverting the frontends restores today's behaviour.
  - Reverting the backend leaves stored `studyModeEnabled` fields that nothing reads, which is harmless.
- Deploy the backend before the frontends, which call `?mode=study` and the new endpoints.

## Open Questions

- Copy for the instructor-disabled notice and the phone banner, in both apps. Final wording can be tuned in review without changing behaviour.
