# Crowd-Sourced Question Bank — Bugs & Problems (V3, re-audited)

Re-audit of the `studentQuestions` pipeline as it exists **in code today**, after rebasing onto
`upstream/main` (which brought in commit `0996010e3` *"feat(crowd-q): peer-validation gate before
instructor approval (V3)"*). Cross-checked against [CROWD_QUESTION_BANK.md](vibe/backend/src/modules/studentQuestions/CROWD_QUESTION_BANK.md)
and the modules it depends on (`quizzes`, `courses`, `notifications`, shared DB).

This **supersedes the earlier V1.1 audit.** Those headline findings — "the V3 system doesn't
exist", "submissions auto-promote into the GRADED bank", "unreviewed questions served in graded
quizzes" — are **now fixed** (see below). The V3 code introduced *new* critical bugs in their place.

Each finding: **location → what's wrong → why it matters → fix**. Severity: 🔴 Critical · 🟠 High · 🟡 Medium · ⚪ Low.

---

## ✅ Fixed since V1.1 (no longer bugs)

| Old finding | Status now | Evidence |
|---|---|---|
| **#1** Submissions auto-promoted into the **graded** bank on submit | ✅ **Fixed** | `createQuestion` calls [`_stageToSubmittedBank`](vibe/backend/src/modules/studentQuestions/services/StudentQuestionService.ts#L337), which adds the question to a **separate** `crowdSubmitted:true` bank via [`findOrCreateCrowdSubmittedBank`](vibe/backend/src/modules/quizzes/services/QuestionBankService.ts#L193-L232), **not** the graded bank. |
| **#2** Unreviewed questions served in graded attempts | ✅ **Fixed** | The Submitted bank is **never added to the quiz's `questionBankRefs`**, so it can't be drawn into a graded attempt. |
| **#0** "The V3 system doesn't exist" | ✅ **Obsolete** | `crowdGate.ts`, `COLLECTING/ELIGIBLE` states, counters, `findOrCreateCrowdSubmittedBank`, `promoteSubmittedQuestionToGraded` all now exist. |

> ⚠️ The pipeline flipped failure modes: it went from *"promotes too eagerly (unreviewed reaches
> graded)"* to *"can't promote at all — approval destroys the question"* (see **C1**).

---

## C1. Approving a question **soft-deletes it** instead of promoting it 🔴 (data loss) — ✅ FIXED

> **✅ Fixed (2026-06-28).** `promoteSubmittedQuestionToGraded` no longer calls `removeQuestion`
> (which soft-deletes the shared Question). It now adds the question to the graded bank and
> detaches only the *reference* from the Submitted bank via a new
> `QuestionBankRepository.removeQuestionRefFromBank` (a targeted `$pull` that never touches the
> Question document). The add step is guarded for idempotency so a retry can't duplicate the ref
> or lose the question. Regression test:
> [QuestionBankService.promoteSubmittedQuestionToGraded.test.ts](vibe/backend/src/modules/quizzes/tests/QuestionBankService.promoteSubmittedQuestionToGraded.test.ts).
> **Backfill caveat:** questions approved *before* this fix were already soft-deleted and are
> **not** auto-repaired — they need a one-off migration to clear `isDeleted` and ensure they sit
> in the graded bank.

**Original report (for context):**

**Path:** [updateQuestionStatus → APPROVED](vibe/backend/src/modules/studentQuestions/services/StudentQuestionService.ts#L569-L580)
calls `questionBankService.promoteSubmittedQuestionToGraded(promotedId)`
([QuestionBankService.ts:243-258](vibe/backend/src/modules/quizzes/services/QuestionBankService.ts#L243-L258)), which does:

```ts
await this.addQuestion(gradedBankId, questionId);               // 1. add to graded bank
await this.removeQuestion(submitted._id.toString(), questionId); // 2. "remove from submitted"
```

But `removeQuestion` ([QuestionBankService.ts:260-309](vibe/backend/src/modules/quizzes/services/QuestionBankService.ts#L260-L309))
has its array-splice **commented out** ([:288-298](vibe/backend/src/modules/quizzes/services/QuestionBankService.ts#L288-L298));
its only effective action is:

```ts
const deleteResult = await this.questionRepository.delete(questionId, session); // SOFT-DELETES the Question doc
```

And `QuestionBankRepository.getById` **excludes soft-deleted questions** on read (it maps
`questions` to strings after filtering deleted ones).

**Why it matters:** Step 2 doesn't "move" the question — it **soft-deletes the underlying
Question**. Immediately after a successful approve, the just-added graded-bank entry points at a
soft-deleted question and is filtered out of every future draw. **The approved crowd question
never appears in the graded quiz** — and the failure is silent (the caller's `.catch` only logs).
The method's own comment ("leaves the question in both, never neither") is wrong: it ends up
**deleted**.

**Fix:** `removeQuestion` must remove the bank *reference* (re-enable the splice + bank update)
and **not** soft-delete the shared Question; or give `promoteSubmittedQuestionToGraded` a
dedicated "detach from submitted bank only" call. Add a test: approve → assert the question is
drawable from the graded bank.

---

## C2. The whole peer-validation gate is unreachable dead code 🔴 (feature is inert)

**Location:** [recordPeerResponse](vibe/backend/src/modules/studentQuestions/services/StudentQuestionService.ts#L355-L370)
→ `repository.recordCrowdResponse` / `markEligible`. Full-tree search: **`recordPeerResponse` has
zero callers.** Serving is disabled in `AttemptService._getQuestionsForAttempt` (crowd questions
are never appended to an attempt), and attempt submission never calls capture.

**Why it matters:** No live path increments `responseCount/correctCount/thumbs*`, so
`evaluateCrowdGate` never sees real data and `gateState` never advances from `COLLECTING` to
`ELIGIBLE`. The "peer-validation gate before instructor approval" — the entire point of commit
`0996010e3` — **does nothing at runtime**. Questions can only progress via a direct instructor
approve (which currently destroys them — see **C1**). Partly intentional per the doc (serving is
disabled until a relevance filter exists), but it ships as if live.

**Fix:** Wire `recordPeerResponse` into the attempt-submit flow (capture) behind the relevance
filter, or explicitly mark the gate as not-yet-active.

---

## H1. No role/authorization check on approve, reject, or edit 🟠

**Location:** [updateStatus](vibe/backend/src/modules/studentQuestions/controllers/StudentQuestionController.ts#L202-L224)
and [updateQuestion](vibe/backend/src/modules/studentQuestions/controllers/StudentQuestionController.ts#L175-L200)
use bare `@Authorized()` (no roles); the service never checks an instructor role; and the module's
own checker returns `true` unconditionally ([index.ts:45-47](vibe/backend/src/modules/studentQuestions/index.ts#L45-L47)).

**Why it matters:** Any authenticated user can approve/reject **any** question — a student can
"approve" their own submission (which, given **C1**, also soft-deletes it). Broken access control.

**Fix:** Require an instructor/teacher course role on the review endpoints.

---

## H2. No ownership check when editing a question 🟠

**Location:** [updateQuestion](vibe/backend/src/modules/studentQuestions/services/StudentQuestionService.ts#L409-L422)
→ `findById` matches `courseId/courseVersionId/segmentId/questionId` but **not `createdBy`**.

**Why it matters:** Any user can edit another user's PENDING question (rewrite text/options/correct
answer). With **H1** it's trivially abusable.

**Fix:** Scope student edits to the author, or require instructor role.

---

## H3. The two update endpoints diverge — status changes via `updateQuestion` skip the promotion sync 🟠

**Location:** [updateQuestion](vibe/backend/src/modules/studentQuestions/services/StudentQuestionService.ts#L473-L518)
accepts a `status` transition (incl. `APPROVED`/`REJECTED`) and only notifies — it never calls
`setReviewStatus`, `promoteSubmittedQuestionToGraded`, or `delete`. Only
[updateQuestionStatus](vibe/backend/src/modules/studentQuestions/services/StudentQuestionService.ts#L566-L586)
does that sync.

**Why it matters:** Approving through the content-edit endpoint flips status to `APPROVED` but
**never moves it into the graded bank**, and rejecting there never removes the promoted copy. Same
action, two endpoints, two outcomes → silent inconsistency.

**Fix:** Extract the promotion-sync into one helper used by both paths, or forbid status changes on
the content endpoint and route all reviews through `updateStatus`.

---

## H4. Create→stage isn't atomic; the id back-write is silently swallowed 🟠

**Location:** [_stageToSubmittedBank](vibe/backend/src/modules/studentQuestions/services/StudentQuestionService.ts#L100-L106):
`addQuestion(...).catch(...)` and `setPromotedQuestionId(...).catch(() => {})`, all inside a
`try/catch` that only `console.warn`s. No transaction spans insert + stage.

**Why it matters:** If `setPromotedQuestionId` fails (swallowed), the student question has **no
`promotedQuestionId`** → a later approve/reject finds nothing to promote/delete, so the staged copy
is stranded in the Submitted bank forever. Partial failures also orphan the `SOLQuestion`.

**Fix:** Run insert + stage in one Mongo session/transaction; don't swallow the id back-write.

---

## M1. Instructor queue doesn't surface `ELIGIBLE` 🟡

**Location:** [listByCourseVersion](vibe/backend/src/modules/studentQuestions/repositories/providers/mongodb/StudentQuestionRepository.ts#L102-L122)
filters only on `status`; there is no `gateState === 'ELIGIBLE'` filter.

**Why it matters:** Even if the gate worked (**C2**), the instructor list can't distinguish
gate-passed (`ELIGIBLE`) from still-`COLLECTING` questions — it returns all PENDING. The spec's own
open item ⛔ flags this.

**Fix:** Add an optional `gateState` filter; default the instructor queue to `ELIGIBLE`.

---

## M2. Duplicate detection has a check-then-insert race (no unique index) 🟡

**Location:** `findDuplicate` then `create` ([StudentQuestionService.ts:312-335](vibe/backend/src/modules/studentQuestions/services/StudentQuestionService.ts#L312-L335)).
The question collection has only **non-unique** indexes ([repo init:42-49](vibe/backend/src/modules/studentQuestions/repositories/providers/mongodb/StudentQuestionRepository.ts#L42-L49)).
(The *responses* collection does have a proper unique index — good — but the question signature does not.)

**Why it matters:** Concurrent identical submits both pass the check and both insert.

**Fix:** Partial **unique** index on `{courseVersionId, segmentId, normalizedSignature}` where
`isDeleted != true`; treat the duplicate-key error as "similar exists".

---

## M3. Editing a staged question doesn't update the promoted copy 🟡

**Location:** [updateQuestion](vibe/backend/src/modules/studentQuestions/services/StudentQuestionService.ts#L497-L507)
updates the student-question content but never updates the `SOLQuestion` already staged in the
Submitted bank.

**Why it matters:** The Submitted-bank copy is a stale snapshot; edits don't propagate, so an
eventually-approved question can carry outdated content.

**Fix:** Propagate content edits to the promoted Question (or stage only at approval time).

---

## M4. `correctOptionIndex` is returned to clients 🟡

**Location:** every list response includes `correctOptionIndex` — e.g.
[listBySegment](vibe/backend/src/modules/studentQuestions/controllers/StudentQuestionController.ts#L122-L137)
(plain `@Authorized()`).

**Why it matters:** If the segment list surfaces peer questions to students, the correct answer
ships in the payload.

**Fix:** Omit `correctOptionIndex` from student-facing responses; include it only for the author's
own items / instructor views.

---

## M5. `recordCrowdResponse` is non-atomic (insert then separate `$inc`) 🟡

**Location:** [recordCrowdResponse](vibe/backend/src/modules/studentQuestions/repositories/providers/mongodb/StudentQuestionRepository.ts#L331-L375):
inserts the response doc (idempotency guard), then a **separate** `findOneAndUpdate` bumps counters
— not in a transaction.

**Why it matters:** A crash between the two leaves the response recorded (unique index set) but
counters un-incremented → permanent undercount, and that user is locked out of retrying (dup-key
returns `null`). Latent until capture is wired, but it will bite then.

**Fix:** Wrap both writes in one session/transaction.

---

## M6. Staging only ever targets `questionBankRefs[0]` 🟡

**Location:** [_stageToSubmittedBank:69-71](vibe/backend/src/modules/studentQuestions/services/StudentQuestionService.ts#L69-L71)
— `?.questionBankRefs?.[0]?.bankId`. A quiz with multiple banks always derives the Submitted bank
from bank `[0]`; if `[0]` has no `bankId` it silently returns and the submission is never staged.

**Fix:** Pick the target bank deliberately; surface the "no bank" case instead of silently returning.

---

## M7. `_resolveTargetQuiz` sorts fractional-index `order` with `localeCompare` 🟡

**Location:** [StudentQuestionService.ts:131-133](vibe/backend/src/modules/studentQuestions/services/StudentQuestionService.ts#L131-L133).
`ItemRef.order` is a **string** fractional-index key; `localeCompare` is locale/collation-aware and
can disagree with the codepoint ordering fractional indexing relies on → wrong "next quiz".
(Medium confidence.)

**Fix:** Compare raw strings (`a.order < b.order ? -1 : …`).

---

## M8. Options aren't checked for distinctness 🟡

**Location:** [validateOptions](vibe/backend/src/modules/studentQuestions/services/StudentQuestionService.ts#L227-L243)
checks count + length only; `["Yes","Yes"]` passes.

**Fix:** Reject when the normalized option set has fewer entries than the array.

---

## L1. Dead code (now a larger surface) ⚪

`findApprovedForSegments` (no callers), plus the disabled serving/capture helpers
`findCollectingForSegments`, `listAnsweredQuestionIds`, `findByIds`, `recordPeerResponse`,
`recordCrowdResponse`, `markEligible`. Several (e.g. `findCollectingForSegments`,
`findApprovedForSegments`) are scoped by `segmentId` only — **no `courseVersionId`** — a latent
cross-version bleed if revived.

**Fix:** Delete, or gate behind the not-yet-built relevance filter with a tracking note + course scoping.

---

## L2. `removeQuestion` leaves stale ids in bank arrays ⚪

Even setting aside **C1**, the commented-out splice ([QuestionBankService.ts:288-298](vibe/backend/src/modules/quizzes/services/QuestionBankService.ts#L288-L298))
means `questions[]` arrays never shrink; correctness relies entirely on read-time soft-delete
filtering. Arrays grow unbounded with tombstones.

**Fix:** Re-enable reference removal (without deleting the shared Question — see C1).

---

## L3. `init()` swallows index-creation errors ⚪

[repo init:41-57](vibe/backend/src/modules/studentQuestions/repositories/providers/mongodb/StudentQuestionRepository.ts#L41-L57)
sets `initialized = true` before indexes build and hides failures in an empty `catch {}`.

**Fix:** Build indexes via startup migration; log real errors.

---

## L4. DTO enum fields aren't enforced ⚪

[StudentQuestionValidator.ts](vibe/backend/src/modules/studentQuestions/classes/validators/StudentQuestionValidator.ts):
`questionType` and the status filters are `@IsString` only (enum lives in `@JSONSchema`, doc-only).

**Fix:** Use `@IsIn([...])`.

---

## L5. No submission rate limiting ⚪

`createQuestion` has no per-(user,segment) throttle; the signature includes `correctOptionIndex`,
so trivial variants aren't "duplicates" → a user can flood the Submitted bank.

**Fix:** Throttle submissions per user/segment.

---

## L6. Test coverage is still just `_resolveTargetQuiz` ⚪

[the only test file](vibe/backend/src/modules/studentQuestions/tests/StudentQuestionService.resolveTargetQuiz.test.ts)
exercises one private helper. Staging, the gate, capture idempotency, approve/reject sync, and the
two-endpoint divergence are all untested — including the **C1** data-loss path.

**Fix:** Add service-level tests for stage→approve→drawable, reject→removed, gate eligibility, and
capture idempotency.

---

## Priority order

1. **🔴 C1** — ✅ **FIXED** (2026-06-28): approval now moves the question into the graded bank and
   detaches the Submitted-bank reference without soft-deleting it. *Backfill of already-corrupted
   approvals still pending.*
2. **🔴 C2** — the gate is inert dead code; wire capture or mark it explicitly inactive.
3. **🟠 H1 / H2** — add instructor-role + ownership authorization.
4. **🟠 H3 / H4** — converge the two endpoints; make create→stage atomic.
5. **🟡 M1–M8** — eligibility surfacing, dedup race, drift, answer leak, capture atomicity,
   bank-selection, ordering, option distinctness.
6. **⚪ L1–L6** — dead code, bank-array hygiene, index init, DTO enums, rate limiting, tests.
