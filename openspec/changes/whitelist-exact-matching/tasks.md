# Tasks

Backend first (groups 1–2), then v3 (group 3), then production frontend (group 4).
- **Backend tests:** run from `backend/` with `npx vitest run <file>`, and the format check with `bash .github/scripts/check-backend-format.sh origin/main <out-file>`.
- **v3 checks:** run from `v3/` with `npx vitest run --root apps/student` and `npx tsc -b apps/student/tsconfig.app.json apps/student/tsconfig.spec.json`.
- **No real email:** approval sends a status email, so stub the mail sender in every test that approves, and use only the local database.

## 1. Backend: matching and mode

- [x] 1.1 Add `modules/courseRegistration/utils/autoApproval.ts` (design decision 1) with `parseEntry`, `resolveMode`, `shouldAutoApprove` and `normalizeEntries`, plus unit tests for every scenario under "Whitelist entries match exactly", and for case, spaces, an email with no `@`, and missing or null mode.
- [x] 1.2 Add the optional `autoApprovalMode` to `models.ts` (registration settings and `ICohortSettings`), the repository interfaces, `SettingRepository.updateRegistrationSettings`, `CourseRepository.create/updateCohortSettings`, `AutoApprovalSettingsBody` (`@IsOptional @IsIn`, plus corrected descriptions), and the service's `updateSettings` and `updateAutoApprovalSettings`.
- [x] 1.3 Return the resolved mode from `getSettings`, for the course and each `cohortSettingDetails` entry.
- [x] 1.4 Replace both copies of the check in the submit handler with one `shouldAutoApprove` call on the course or cohort settings, loading the account email only for `LIST`. The returned statuses and `updateStatus` calls stay the same.

## 2. Backend: saving and integration tests

- [x] 2.1 In `PUT auto-approval`, normalise and validate before calling the service, returning a 400 that names invalid entries (design decision 3). Work out a missing mode from the list. Store an empty list for `EVERYONE`.
- [x] 2.2 Add a failing test first that confirms the wipe: save a list, `PUT build-form` with only the schemas, and read the settings. Then fill the missing auto-approval fields from `getSettings` in the `PUT build-form` handler (design decision 4), leaving `isActive` as it is.
- [x] 2.3 Add `backend/src/modules/courseRegistration/tests/AutoApproval.test.ts`, using the authenticated harness of `courses/tests/StudyMode.test.ts` (with `IS_RECAPTCHA_ENABLED` off), covering every scenario in `specs/backend/course-registration-auto-approval` that isn't already unit-tested:
  - the account email rather than the form's;
  - `EVERYONE`, empty `LIST`, and auto-approval off;
  - stored settings with no mode, with and without a list;
  - saving: normalising, 400 with settings unchanged, no mode;
  - form save keeping the settings;
  - cohort list and cohort mode;
  - approved and enrolled; a pending request unchanged after the list changes.
- [x] 2.4 Run the full backend suite (excluding CI's known-broken files) and the format check, and confirm both pass.

## 3. v3 Studio

- [x] 3.1 Regenerate the API types against the backend from group 2, and re-capture `test/fixtures/studio/registration-settings.json` from it rather than editing it by hand.
- [x] 3.2 Update `features/admin/registration-api.ts`: add `autoApprovalMode` to the type, mapping and saves (`useSaveRegistrationForm`, `useSaveAutoApproval`), and correct the contract comments on lines 12–13.
- [x] 3.3 Update `features/admin/course-registration.tsx`: the Everyone / Only these emails `RadioGroup`, the list shown only for the second, the empty-list note, the new help text, a placeholder that fits the rules, and `dirty`/Discard including the mode. Stop clearing the list when the switch is off.
- [x] 3.4 Extend `features/admin/registration.spec.tsx` for every scenario in `specs/v3/course-registration-auto-approval`, and update its existing assertions. Run the v3 checks and `NX_DAEMON=false npx nx run-many -t lint typecheck --projects=student,api,proctoring --parallel=1`, and confirm they pass.

## 4. Production frontend

- [x] 4.1 Update `hooks.ts` (`useUpdateAutoApprovalsettings` and the settings types) and `auto-approval-modal.tsx`: the choice, for the course and the selected cohort; the list shown only for listed emails; the new help text and placeholder; the mode in the save body; the backend's message shown on failure, with the modal left open. Compare per-file TypeScript error counts with `main`, because `frontend/` has a baseline of errors, and confirm these two files gain none.

## 5. End-to-end check

- [x] 5.1 Against the local stack (backend :4002, v3 :4310, old frontend :4311, database `vibe_v3_local`, with outgoing mail not sending):
  - in Studio, save "Only these emails" with an address and a domain; register a matching and a lookalike account, and check approved and enrolled against pending;
  - switch to an empty list and check a new registration stays pending, then to "Everyone" and check it's approved;
  - in the production app, set a cohort's list, then edit the registration form and check the list survives;
  - save `iitm` in both apps and check the error shows.

  Record the results in the PR description.

## Workflow follow-up

- Deploy the backend first, then `deploy-frontend-v3` and `deploy-frontend`.
- Before deploying, decide whether to run the read-only count of production entries that will stop matching (design, Risks). It isn't part of this change's tasks because it needs production access.
- Archive this change after its PR merges and deploys.
