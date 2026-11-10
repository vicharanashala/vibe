# Design

## Context

The motivation is in proposal.md, and the behaviour is in the two delta specs. This section covers only the current state that shapes the approach.

- **Storage.** Forms are FEEDBACK items stored in `feedback_forms`, with `details: { jsonSchema, uiSchema }` (rjsf), keyed by label. Submissions are in `feedback_submissions` (`FeedbackRepository`), with `{ userId, courseId, courseVersionId, cohortId?, details, feedbackFormId, previousItemId, previousItemType, createdAt }`.
- **Submit.** `POST /quizzes/:itemId/feedback/submit` → `AttemptService.submitFeedBackForm`. It:
  - requires an item before the form, and throws when there isn't one
  - requires that item to be complete when it's a video
  - always inserts, because the duplicate guard is commented out
  - trusts the client for `cohortId`, which v3 never sends
- **Reading.**
  - `GET /courses/:courseId/item/:feedbackId/feedback/submissions` pages the responses and searches by `user.firstName` regex only.
  - `.../submissions/export` builds a CSV from `getAllSubmissionsWithLabels`. That uses raw field keys as columns, `Name`/`Email` from `details`, and `toLocaleString()` on the server.
- **Gurusetu.** `GET /users/enrollments/courses/:c/versions/:v/export/gurusetu-feedback` → `EnrollmentRepository.getGuruSetuFeedbackRows` joins enrolled students × videos × watch time × feedback efficiently (one pass per collection, then in-memory maps), but it's gated to `GURU_SETU_FEEDBACK_EXPORT_COURSES`. The old frontend turns it into a CSV in the browser.
- **v3 student.** `GreenFeedback` in `features/learn/lesson-page.tsx` sends answers and stops the item. It never loads earlier answers, and a reopened form starts empty. Study mode shows a disabled preview.
- **v3 Studio.**
  - `features/admin/editor/feedback-editor.tsx` has the builder (fields in `features/feedback/form-schema.ts`: text…checkboxes, rating, yes/no) and a responses tab (paged list, search, Summary from one `limit=1000` request).
  - "Download CSV" calls the backend export.
  - There's no course-level feedback view.
- **Old frontend.** It renders forms with rjsf and must keep working with forms v3 saves.

## Goals / Non-Goals

**Goals:**
- Fix the submission model once in the backend (current answer, history, cohort, placement), so every client and export agrees.
- One export builder on the server that writes both formats from the same row model, so Excel and CSV never disagree.
- Reuse the Gurusetu join's performance approach for the generic Watch + feedback sheet.

**Non-Goals:**
- Changing the old frontend's screens (its Gurusetu menu keeps calling the old endpoint).
- Charts inside the workbook, or scheduled or emailed exports.
- Feedback on quizzes' individual questions (`/quiz/:id/submission/.../feedback`), which is a different feature.
- Anonymous forms. Answers stay tied to the student's account, as today.

## Decisions

### 1. "Current answer" is a flag on the submission, kept up to date on write
**On submit:** inside the existing transaction, set `isCurrent: false, replacedAt: now` on the student's earlier submissions for the same `feedbackFormId`, then insert the new one with `isCurrent: true`.

**On read:** "current" is the latest submission per `(userId, feedbackFormId)`, ranked with `$setWindowFields` by `_id` (insertion order). Old duplicates were written without the flag, so this rule covers them too. Cohort isn't part of the identity, because older submissions have none. No data migration is needed.

**Index:** add one on `{feedbackFormId, userId, createdAt}`.

**Rejected:**
- Overwriting in place: it loses history the spec keeps.
- A migration to dedupe: risky on production data, and unnecessary given the read rule.

### 2. Cohort from the enrollment, not the client
`submitFeedBackForm` looks up the student's enrollment for the course version and uses its `cohortId`. A client-sent value is ignored if it disagrees. Other endpoints already resolve cohort this way through `CohortScopeService`/enrollment.

### 3. Forms first in a section
Studio refuses to create a feedback form as the first item of a section, but hiding or deleting the lesson before one makes it first. Visible items are read in section order, the same way course progression reads them. When there's no visible item before the form, store `previousItemId: null, previousItemType: null` and skip the video check. The FEEDBACK-after-FEEDBACK refusal stays. Exports show "About lesson" as empty for these.

### 4. Own-answer endpoint
`GET /quizzes/:itemId/feedback/mine` returns `{ details, createdAt } | null` for the signed-in user, filtered by `userId` from the token. v3 loads it in `GreenFeedback` and in the study preview.

### 5. One server-side export builder, two formats
**Module:** `modules/courses/services/FeedbackExportService.ts`.

**Endpoints:**
- `GET /courses/:courseId/versions/:versionId/feedback/export?format=xlsx|csv&cohortId=&history=latest|all`
- `GET /courses/:courseId/item/:feedbackId/feedback/export?format=xlsx|csv&history=…`

The existing `/submissions/export` route is kept, now returning the new per-form CSV.

**Access:** checked with the same `EnrollmentActions.ViewAll` ability the Gurusetu export uses, plus cohort scoping through `CohortScopeService`.

**Data gathering** (bounded queries, no per-student lookups):
1. The version structure: modules → sections → items, in order. This gives each form's module, section and form name, and the item before it.
2. All forms in the version, with their schemas.
3. All submissions for those forms, sorted.
4. The enrolled students: account name, email, cohort, progress percent.
5. For the Watch + feedback sheet, the existing Gurusetu-style aggregation, generalised and moved to a shared repository method (watch seconds capped at the video duration, session count, first and last watch).

**Row model:** one function turns a submission plus its form into ordered `{ column: value }` pairs:
- fixed columns first: Student, Email, Cohort, Module, Section, Form, About lesson, Submitted (IST), Submitted (ISO), Version (Current/Replaced, when history is on)
- then one column per question, in `ui:order`, titled by the field's title or label
- choices mapped through `oneOf` titles (fallback: `enum` value), checkbox arrays joined with "; ", "Other" text in the same cell as "Other: …"

The renamed-question case is handled by keying columns on the stored property key (`fieldName`) and titling them with the current label.

**Formats:**
- **xlsx:** a small SpreadsheetML writer (`modules/courses/utils/xlsxWriter.ts`) zipped with `archiver`, which is already a backend dependency: bold frozen header row, auto-filter, column widths, numbers kept as numbers. Sheet names are the form names, cleaned of characters Excel forbids, truncated to 31 characters and de-duplicated. `exceljs` was planned but isn't installed, and adding it would mean a new dependency for a few hundred lines of XML.
- **csv:** `csv-writer` (already a dependency) with a UTF-8 BOM, so Excel opens Indian-language text correctly.
  - The course CSV is one file: a row per answer across all forms, with the form name as a column and a union of question columns.
  - A separate `type=watch` CSV holds the Watch + feedback rows.

**Response:** streamed with `Content-Disposition` named `<course>-feedback-<YYYY-MM-DD>.<ext>`.

**Rejected:** building the workbook in the browser. It would mean many paged requests, slow on big courses, and a heavy xlsx library in the student bundle.

### 6. The Gurusetu endpoint stays, using the shared join
`getGuruSetuFeedbackRows` keeps its route, allowlist and row shape for the old frontend, but calls the shared watch + feedback aggregation. That keeps a single implementation, and the old app keeps the same output.

### 7. New field kinds stay rjsf-compatible
- **Section heading:** a property with `type: 'null'`, plus `title`/`description`. rjsf renders it as a heading, and it asks for no answer.
- **Linear scale:** `type: 'integer'`, `minimum`/`maximum`, `ui:widget: 'radio'`, `ui:options: { display: 'scale', minLabel, maxLabel, inline: true }`. The old frontend shows it as radios.
- **Other:** the choice list gains a final `"Other"` option, plus a sibling string property `"<key> (other)"` with `ui:options.otherFor = key`. v3 shows it inline only when Other is picked, and the old frontend shows it as a plain text field.

`form-schema.ts` round-trips all three. Exports render the "Other" text with its choice.

### 8. Studio: Feedback tab and per-form downloads
- **Course page:** a new "Feedback" tab lists every feedback form (module, section, about lesson, current responses) with links to its responses. The list comes from one endpoint, `GET /courses/:courseId/versions/:versionId/feedback/forms` (staff only, cohort-scoped), which reuses the export service's course structure and counts current answers in one aggregation, instead of one request per form, and a "Download feedback" menu (Excel workbook / CSV / Watch + feedback CSV, Latest or Include earlier versions, cohort select).
- **Feedback editor responses tab:**
  - search goes to the backend, which now matches first name, last name or email
  - a cohort filter
  - a response opens a Sheet with that student's answers and history (`GET …/feedback/submissions?userId=` with `history=all`)
  - the Summary uses a new server aggregate (`GET …/feedback/summary`), so it isn't capped at 1,000
- **Downloads:** go through the API client as a blob, as today, with a sonner toast and an error state.

### 9. Study-mode feedback, behind a per-course switch
Strict mode is PC-only, so phones only have study mode.

- **Setting:** `settings.studyModeFeedback` on the course settings document, read as on unless it is `false`. Students already receive course settings through `GET /setting/course-setting/:c/:v`, so the v3 form knows without a new call. Studio reads and changes it through `GET`/`PUT /courses/:c/versions/:v/feedback/settings`: reading needs course staff, changing needs permission to edit the course.
- **Submit:** the body takes `mode: 'strict' | 'study'` (default strict). For study mode:
  - refuse when the setting is off
  - after a video, require a recorded study view (the `studyViews` collection from study progress) instead of strict completion
  - never read or write strict progress
- **Lazy dependencies:** the settings repository and study views are resolved only on the study path, so strict submissions don't depend on them.
- **Mode:** each submission stores `mode`, and the latest answer wins across modes. Exports add a "Mode" column, plus "Answer mode" on Watch + feedback. Studio shows a Study or Strict badge.
- **v3:** a `StudyFeedbackForm` replaces the read-only preview when allowed, and keeps it when not. Studio's Feedback tab has the switch.

### 10. Phones
- **Student form:** choice and checkbox rows are full-width, 40 px tap targets.
- **Summary:** each choice and its count share a line, with a full-width bar below.
- **Controls:** tabs, Download, search and cohort select are 40 px or taller on phones.
- **Response pane:** full width on phones.
- **Wide tables:** at tablet width they keep the first column sticky.

## Risks / Trade-offs

- **[Risk] Large courses (thousands of students × many videos) make big workbooks** → Write the workbook with a lean XML writer and project only the needed fields. The Watch sheet uses the already-optimised Gurusetu approach. The cap is the HTTP timeout, so it's measured on the largest production course during implementation.
- **[Risk] Old duplicates make "current" ambiguous when two submissions share a timestamp** → Rank by `_id` (insertion order, which follows insert time); MongoDB's `$documentNumber` takes a single sort key.
- **[Risk] Old frontend shows the "Other" text field even when Other isn't picked** → Acceptable: it's optional and labelled.
- **[Risk] Cohort lookup on submit adds a query** → It's one indexed enrollment read inside the existing transaction.
- **[Trade-off] Exports use the student's account name, not the name typed in the form** → The spec asks for this. Typed Name/Email answers still appear as ordinary question columns when the form asks for them.

## Migration Plan

1. Deploy the backend first. It adds the flag and the new endpoints, keeps the old routes, needs no data migration, and builds the index on startup the way existing repositories do.
2. Deploy v3.

Rollback: redeploy the previous backend. The `isCurrent` flag is ignored by old code, which simply counts every row again.

## Open Questions

- The exact Gurusetu production course sizes, for the export timing check. They're measured during implementation and don't change the design.
