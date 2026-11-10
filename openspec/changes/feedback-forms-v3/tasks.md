# Tasks

Backend checks: `npx vitest run <files>` from `backend/`, `npx tsc --noEmit -p backend`, and `bash .github/scripts/check-backend-format.sh origin/main <out>`. v3 checks (from `v3/`): `npx vitest run --root apps/student` and `npx tsc -b apps/student/tsconfig.app.json apps/student/tsconfig.spec.json`.

## 1. Backend: submission rules

- [x] 1.1 In `AttemptService.submitFeedBackForm`, mark the student's earlier submissions for the form `isCurrent: false, replacedAt` and insert the new one with `isCurrent: true` in the same transaction; add the `{feedbackFormId, userId, createdAt}` index in `FeedbackRepository.init`; verify with a unit test (resubmit → one current, one replaced) and a test that pre-existing duplicates resolve to the latest
- [x] 1.2 Resolve `cohortId` from the student's enrollment on submit (ignore a disagreeing client value); verify with a test where the client sends none and the stored submission has the enrollment's cohort
- [x] 1.3 Accept a form with no item before it in its section (store `previousItemId/Type: null`, skip the video check), keep refusing FEEDBACK-after-FEEDBACK, and change the unfinished-video message to "Watch the previous video before sending this feedback."; verify with tests for each case
- [x] 1.4 Add `GET /quizzes/:itemId/feedback/mine` returning the signed-in student's current answer or null; verify with tests for none, current-after-resubmit, and that another user's answer is never returned
- [x] 1.5 Make the submissions list, search and summary use current answers: search matches first name, last name or email; add `userId`, `cohortId` and `history=all` query options; add `GET /courses/:courseId/item/:feedbackId/feedback/summary` (per-question counts, averages, latest texts, uncapped); verify with repository/service tests

## 2. Backend: exports

- [x] 2.1 Create an .xlsx writer on `archiver` (`utils/xlsxWriter.ts`) and `FeedbackExportService` with the row model (fixed columns, question columns in `ui:order` keyed by stored key and titled by current label, choice labels, "; " joins, "Other: …", IST + ISO times, Version column with history); verify with unit tests on a fixture form including renamed questions, checkboxes, scale, Other and a heading
- [x] 2.2 Move the Gurusetu watch + feedback aggregation into a shared repository method (generic for any course, "form directly after the video"), keep `getGuruSetuFeedbackRows` returning the same shape through it; verify the existing Gurusetu tests (or a new one) produce identical rows before and after
- [x] 2.3 Add `GET /courses/:courseId/versions/:versionId/feedback/export?format=xlsx|csv&type=all|watch&cohortId=&history=` (Overview, a sheet per form, Watch + feedback; CSV variants with UTF-8 BOM), streamed with a dated filename and checked with the `EnrollmentActions.ViewAll` ability plus cohort scoping; verify with controller tests (staff gets a workbook with the expected sheets and headers, read back with a small test zip reader; student refused; cohort filter applied)
- [x] 2.4 Add `GET /courses/:courseId/item/:feedbackId/feedback/export?format=…&history=` and make the existing `/submissions/export` return the new per-form CSV; verify with tests on headers and a choice/checkbox row
- [x] 2.5 Regenerate the v3 API types from the backend OpenAPI (as done for earlier endpoints in `@vibe/api`) and verify v3 typecheck still passes

## 3. v3: students

- [x] 3.1 In `GreenFeedback`, load `feedback/mine`, prefill answers with "You answered this on <date>", label the button Update, and skip re-sending on Continue without edits; verify with specs in `features/learn/feedback-lesson.spec.tsx`
- [x] 3.2 Show backend refusals in plain language and keep the answers (unfinished video → message with a link to the previous lesson); verify with a spec for the refused submission
- [x] 3.3 Study-mode preview shows the student's current answers when present, still disabled with the strict-mode note; verify with a spec

## 4. v3: form builder

- [x] 4.1 Add section heading, linear scale (range, end labels) and "Other (please specify)" to `form-schema.ts` with the rjsf-compatible encoding from design §7, round-tripping existing forms unchanged; verify with `form-schema.spec.ts` cases for each kind and an old-frontend-shaped form
- [x] 4.2 Render the new kinds in `FeedbackFormFields` (heading, scale with end labels, Other text shown when Other is picked) and offer them in the builder UI with shadcn controls; verify with Testing Library specs for filling and validation

## 5. v3: Studio responses and downloads

- [x] 5.1 Responses tab: server search by name or email, cohort filter for cohort courses, and a response Sheet with the student's full answers, time sent and earlier versions; verify with specs in `features/admin/editor/editors.spec.tsx` (or a new feedback spec)
- [x] 5.2 Summary uses the new summary endpoint (no 1,000 cap) and shows scale/rating averages and Other texts; verify with a spec where totals exceed 1,000
- [x] 5.3 Per-form download menu (CSV / Excel, Latest or Include earlier versions) with progress, toast and error state; verify with specs that the right request and filename are used
- [x] 5.4 Course "Feedback" tab: list every form (module, section, about lesson, current responses, link to responses) from a new `GET /courses/:courseId/versions/:versionId/feedback/forms` backend endpoint (with backend tests) and a "Download feedback" menu (Excel workbook, CSV, Watch + feedback CSV, history and cohort options); add the tab to `router.tsx` search params and `course-detail-page.tsx`; verify with specs for the list and each download option

## 6. Integration check

- [ ] 6.1 Run the full backend suite for the touched modules, `npx tsc --noEmit -p backend` and the format check, plus the full v3 checks (`npx vitest run --root apps/student --maxWorkers=2`, tsc, `NX_DAEMON=false npx nx run-many -t lint typecheck --projects=student --parallel=1`) and `openspec validate --all --strict`; confirm all pass
- [ ] 6.2 On the local stack (backend :4002, v3), with a course of two videos each followed by a form plus a form first in a section: answer, reopen and update as a student; check Studio responses, search, the history Sheet and the summary; download the course workbook and CSVs and the per-form files and open them, confirming sheets, headers, labels, IST times and latest-vs-history rows; time the export on a production-sized local copy if available. Record the results in the PR, with screenshots

## Workflow follow-up

- Deploy the backend first, then `deploy-frontend-v3`.
- Archive the change after the deploys, syncing `backend/feedback-forms` and `v3/feedback-forms` into the main specs.
