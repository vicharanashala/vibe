# Proposal

## Why

Feedback forms matter most for Gurusetu, where each video is followed by a short form, but they're used across ViBe. In v3 they half-work:
- **Students:** they never see what they answered, and every resubmission is stored as a new response.
- **Cohorts:** v3 doesn't record the student's cohort.
- **Placement:** a form placed first in a section can't be submitted at all.
- **Teachers:** they get one CSV per form, with raw field keys as headers, student-typed names and emails, and no module, lesson or cohort.
- **Gurusetu export:** the only course-wide export (watch time plus feedback per video) lives in the old frontend and works for just two hard-coded courses.

Teachers can't get a clear, complete picture of what students said, so this change makes feedback forms fully work in v3 for students and teachers, with rich exports for any course.

## What Changes

- **Students (v3):**
  - A form they've already answered shows their latest answers. They can update them, and the update replaces their earlier answer everywhere it's counted.
  - Study mode keeps its read-only preview.
  - Clear messages when a form can't be sent yet (for example, the video before it isn't finished).
- **Submissions (backend):**
  - Each student has one current answer per form; earlier versions are kept as history, not counted twice.
  - The student's cohort is recorded.
  - Students can fetch their own latest answer.
  - A form that is first in its section (no lesson before it) can be submitted as a general form instead of failing.
- **Studio responses view (v3):**
  - Search by name or email.
  - Filter by cohort.
  - Open one student's full answers.
  - The summary counts every response, with no 1,000 cap, using each student's latest answer.
- **Studio form builder (v3):**
  - Section headings with descriptions.
  - Linear scales with labelled ends (for example 1 "Not useful" to 10 "Very useful").
  - An "Other (please specify)" choice.
  - Forms stay readable by the old frontend.
- **Exports, for any course** (new backend endpoint, used from Studio; **BREAKING**: none, the old Gurusetu endpoint keeps working for the old frontend):
  - **Excel workbook**: an Overview sheet (one row per student: forms answered, last answer date, progress), one sheet per feedback form (one row per response, one column per question, titled with the question text, choices as their labels), and a "Watch + feedback" sheet (one row per student per video: watch time, watch %, and the answers to the form that follows it).
  - **CSV**: the same per-form and course-wide data as plain CSV.
  - Every row carries the student's account name and email, cohort, module, section and lesson names, the lesson the form is about, and submission time in IST and ISO. "Latest answer per student" is the default, with an option to include every version.
  - The per-form download is upgraded to the same rich columns.

## Capabilities

### New Capabilities
- `v3/feedback-forms`: how students answer feedback forms in the v3 app, and how teachers build forms, review responses and download exports in ViBe Studio.
- `backend/feedback-forms`: feedback submission rules (one current answer per student per form, history, cohort, placement) and the course and per-form feedback exports (Excel and CSV) for any course.

### Modified Capabilities
<!-- None: no existing spec covers feedback forms. -->

## Impact

- **Backend:**
  - `modules/quizzes` (AttemptService.submitFeedBackForm, FeedbackRepository): submission rules, own-answer endpoint, latest-answer queries.
  - `modules/courses` (ItemService/ItemController feedback submissions and export).
  - A new course export endpoint, with the Gurusetu watch-time join generalised from `EnrollmentRepository.getGuruSetuFeedbackRows`.
  - No new dependency: the .xlsx writer uses `archiver`, which the backend already has.
  - Needs a backend deploy, before the v3 deploy.
- **v3:**
  - `features/learn/lesson-page.tsx` (GreenFeedback, the study-mode preview).
  - `features/feedback/*`: form schema and fields, new field kinds.
  - `features/admin/editor/feedback-editor.tsx` and `lesson-api.ts` (responses, summary, downloads), and a course-level export entry in Studio.
- **Old frontend:** no changes. It keeps rendering forms (new field kinds are encoded so rjsf still shows them) and keeps its Gurusetu export.
- **Data:** no migration. Existing duplicate submissions are read as history, and the latest per student counts.
