# Crowd-Sourced Question Bank (Crowd QB)

Design doc for the student-submitted ("crowd") question pipeline in the
`studentQuestions` module. This is the authoritative spec; the personal
research note (`project_crowd_question_pipeline.md`) and PR history are
secondary.

Research framing: RQ3 / RQ-C / backlog B14 (crowd-sourced question bank as a
mechanism for engagement + assessment quality).

---

## Version history

| Version | Behavior | Status |
|---|---|---|
| **V1** | Submission engine — students submit MCQs at the video→quiz transition; stored in `studentSegmentQuestions` as `PENDING`. | Merged (PR #1024) |
| **V1.1** | **Auto-promote on submit** — on submission, the question was immediately copied into the *following quiz's* graded question bank flagged `reviewStatus: PENDING_REVIEW`; teacher Approve/Reject synced the bank. | Merged (PR #1070, #1096) — **superseded by V3, see below** |
| **V3** | **Peer-validated promotion** (this document). Submitted questions go to a **separate, ungraded "Submitted QB"**, are surfaced to students to answer + rate, and only graduate to instructor review once they pass a peer-validation gate. | **Spec — not yet implemented** |

> ⚠️ **V3 reverses V1.1.** Under V3, **auto-promotion on submit must NOT
> happen.** A submitted question is never placed directly into the graded
> question bank. It enters peer validation first.
>
> ✅ **DONE (2026-06-21):** the on-submit path now stages into the separate
> Submitted bank instead of the graded bank. `_promoteToQuestionBank` was
> renamed to `_stageToSubmittedBank` and routes through
> `QuestionBankService.findOrCreateCrowdSubmittedBank(gradedBankId, quizId)`,
> which finds (or lazily creates) the `crowdSubmitted:true` bank keyed by
> `sourceGradedBankId`. The live quiz's `questionBankRefs` are never modified.
> Remaining V3 work (student answer + 👍/👎, the peer-validation gate, and
> approval→graded promotion) is still open.

> 🛑 **CURRENT STATE (2026-06-24): crowd questions are NOT served to students.**
> Peer-validation-by-serving is **disabled** — `AttemptService._getQuestionsForAttempt`
> no longer appends a COLLECTING crowd question to attempts. Rationale: many
> raw student submissions are nonsensical or off-topic, so **no** un-approved
> question should reach a student to answer. **Instructor validation + approval
> is now the only gate** into the graded bank; submissions sit in the separate
> "Submitted – Pending Validation" bank until an instructor approves them.
> The serving helpers (`_findPrecedingVideoSegments`, `_pickCollectingQuestion`,
> `_adaptStudentQuestionToRenderView`) are retained but unused so the path can
> be re-enabled later.
>
> ⚠️ **This is a TEMPORARY measure.** Disabling serving outright also removes
> the peer-validation signal. The intended end state (see *Future work:
> relevance filter* below) is to re-enable serving **only after** an automated
> quality + context-relevance filter screens out meaningless/off-topic
> submissions, so that only sensible, on-context questions are ever shown to
> students.

---

## V3 lifecycle

```
  ┌──────────┐  submit   ┌─────────────────────┐
  │ Student  │ ────────► │  SUBMITTED QB        │   (separate, ungraded bank)
  │ submits  │           │  status: COLLECTING  │
  └──────────┘           └──────────┬──────────┘
                                     │ shown to OTHER students as an
                                     │ ungraded item: answer + 👍/👎
                                     ▼
                          ┌─────────────────────┐
                          │  Peer-validation     │  accumulate:
                          │  gate evaluated       │   - correctRate
                          │  continuously         │   - thumbsDownRate
                          └──────────┬──────────┘
                  passes gate │              │ fails / not yet
                              ▼              ▼
                   ┌──────────────────┐   stays COLLECTING
                   │ status: ELIGIBLE  │   (or eventually EXPIRED/DISCARDED)
                   │ → Instructor queue│
                   └────────┬─────────┘
              approve │            │ reject
                      ▼            ▼
            ┌──────────────────┐  status: REJECTED
            │ Promoted into the │  (removed from rotation)
            │ GRADED quiz QB    │
            │ status: APPROVED  │
            └──────────────────┘
```

### States

- **COLLECTING** — submitted; lives in the Submitted QB (separate bank).
  Ungraded. Served to *other* students alongside (or after) the normal quiz,
  who can **answer it** and give a **thumbs up / thumbs down**.
- **ELIGIBLE** — passed the peer-validation gate; enqueued for instructor
  review.
- **APPROVED** — instructor approved; promoted into the graded quiz question
  bank and counts toward assessment.
- **REJECTED** — instructor rejected; removed from rotation.

(Existing enum is `PENDING | APPROVED | REJECTED`; V3 needs at minimum a
`COLLECTING` / `ELIGIBLE` distinction — see Open questions.)

---

## Separate "Submitted QB"

- Submitted questions are **NOT** written into the graded quiz's question bank.
- They live in a **separate Submitted/Staging question bank** so they can be
  served as **ungraded** items that do not affect the student's score.
- Only on instructor **APPROVAL** does a question move from the Submitted QB
  into the real **graded** quiz question bank.

---

## Student-facing behavior for crowd questions

When a crowd (Submitted-QB) question is shown to a student, they can:

1. **Answer** the question (ungraded — does not affect their grade).
2. Give a **thumbs up** or **thumbs down** on the question quality.

Both signals are recorded per (question, student) and feed the gate.

### Serving rules — one extra question per quiz attempt

> 🛑 **Disabled as of 2026-06-24** — see "CURRENT STATE" note at the top. No
> crowd question is served to students until the relevance/quality filter
> (Future work) is in place. The rules below describe the *original* V3 serving
> design, retained for when serving is re-enabled.

When a student starts a quiz attempt, **exactly one** additional **ungraded**
crowd question is appended to the attempt, drawn from that quiz's pending /
"Submitted – Pending Validation" pool (the COLLECTING questions for the video
segments immediately preceding the quiz). It is rendered like a normal
single-answer MCQ but flagged ungraded and asks for an **answer + 👍/👎**.

- **Ungraded:** `points = 0`, marked `source: 'STUDENT_GENERATED'` /
  `isPeerContributed` on the attempt's `questionDetails`; **skipped in scoring
  and in the completion check** (already handled in `AttemptService._grade`).
- **Eligible pool:** status `PENDING` and **not yet** ELIGIBLE/APPROVED/REJECTED
  (i.e. still COLLECTING, `responseCount < 200`).
- **Exclusions:** never serve a student **their own** submission, and never a
  question they have **already answered** (one response per (question, student)).
- **Pick:** prefer the COLLECTING question with the **fewest responses** so the
  pool advances toward the 200 threshold evenly. If none qualify, the attempt
  simply gets no extra question.

> ⚠️ Supersedes interim "Phase 3": `AttemptService._getQuestionsForAttempt`
> currently appends **APPROVED** student MCQs (`findApprovedForSegments`) as
> ungraded extras. Under V3 that is wrong — APPROVED questions now live in the
> graded bank and count toward the grade. Stage 2 changes this path to serve
> **one COLLECTING (pending)** question instead.

### Capture on submit

On attempt submission, for the served crowd question:

- **Answer → correctness:** compare the student's selected option to the
  submission's `correctOptionIndex`; increment `responseCount` and, if correct,
  `correctCount`.
- **Thumbs:** the submit payload carries a 👍/👎 for the peer question;
  increment `thumbsUpCount` or `thumbsDownCount`.
- **Idempotency:** persist a `(studentQuestionId, userId)` response record so a
  student is counted once even on resubmit/retry.
- **Gate:** after updating counters, call `evaluateCrowdGate(...)`; if eligible,
  flip the question to ELIGIBLE so it surfaces in the instructor queue.

---

## Peer-validation gate (promotion to instructor)

A COLLECTING question becomes **ELIGIBLE** (sent to the instructor for
approval) when **ALL** of the following hold:

1. **Minimum sample:** at least **200** students have answered it
   (`responseCount ≥ 200`). Below this the rates below are not evaluated — the
   question keeps collecting. This guards against promoting on noise from a
   handful of responses.
2. **Difficulty band:** the proportion of students who answer it **correctly**
   is **≥ 30% and ≤ 70%** (`0.30 ≤ correctRate ≤ 0.70`). This is the classic
   item-difficulty / discrimination band — too-easy and too-hard questions are
   filtered out.
3. **Quality:** **thumbs-down rate < 10%** (`thumbsDownRate < 0.10`).

If a question does not meet the gate, it stays in COLLECTING and keeps
gathering responses.

The thresholds live in code in `services/crowdGate.ts`
(`MIN_RESPONSES_FOR_GATE = 200`, `MIN/MAX_CORRECT_RATE`, `MAX_THUMBS_DOWN_RATE`)
— `evaluateCrowdGate()` / `isEligibleForReview()` are the single source of truth.

### Counters per submitted question

| Field | Meaning |
|---|---|
| `responseCount` | # students who answered it (ungraded) |
| `correctCount` | # who answered correctly |
| `correctRate` | `correctCount / responseCount` |
| `thumbsUpCount` | # 👍 |
| `thumbsDownCount` | # 👎 |
| `thumbsDownRate` | `thumbsDownCount / (thumbsUpCount + thumbsDownCount)` *(or / responseCount — TBD)* |

---

## Instructor approval (final step)

- Instructor sees only **ELIGIBLE** questions (those that passed the gate).
- **Approve** → move from Submitted QB into the graded quiz QB; status
  `APPROVED`; student notified.
- **Reject** → status `REJECTED` (reason required); removed from rotation;
  student notified.

---

## What changes from the current code (V1.1 → V3)

- **✅ Remove on-submit auto-promotion (DONE).**
  `StudentQuestionService.createQuestion` now calls `_stageToSubmittedBank`,
  which writes into the separate Submitted bank, not the graded bank.
- **✅ Separate Submitted/staging question bank (DONE).** Identified by
  `crowdSubmitted:true` on the `questionBanks` doc, keyed to its quiz via
  `sourceGradedBankId` / `sourceQuizId`; never added to the quiz's
  `questionBankRefs`, so it stays out of graded draws.
- **🛑 Serve crowd questions to students (DISABLED 2026-06-24).**
  `AttemptService._getQuestionsForAttempt` **no longer** appends a COLLECTING
  crowd question — un-approved submissions are never served. The serving helpers
  (`_pickCollectingQuestion`: fewest-responses-first, excludes the author and
  already-answered; plus `_findPrecedingVideoSegments` /
  `_adaptStudentQuestionToRenderView`) and the `peerCorrectLotItemId` capture
  plumbing remain in place but dormant, so this can be re-enabled once the
  relevance/quality filter screens submissions first.
- **✅ Capture + gate evaluation (DONE).** On submit,
  `AttemptService._capturePeerResponses` scores the answer, reads the `thumb`,
  and calls `StudentQuestionRepository.recordCrowdResponse` (idempotent per
  (question, student) via a unique index on `studentCrowdResponses`), which
  bumps counters; then `isEligibleForReview()` flips the question to ELIGIBLE
  (`markEligible`) once it passes the 200-response gate.
- ⛔ **Instructor queue** should source from ELIGIBLE, not all PENDING. *(not
  built — `listCourseVersionQuestions` still lists all PENDING; needs a
  gateState=ELIGIBLE filter.)*
- **✅ On Approve, promote into the graded QB (DONE).**
  `updateQuestionStatus(...,'APPROVED')` now calls
  `QuestionBankService.promoteSubmittedQuestionToGraded(promotedId)`, which
  adds the question to the quiz's graded bank (via the Submitted bank's
  `sourceGradedBankId`) and removes it from the Submitted bank. Reject still
  soft-deletes the question.

Affected files (current):
- `backend/src/modules/studentQuestions/services/StudentQuestionService.ts`
- `backend/src/modules/studentQuestions/classes/transformers/StudentSegmentQuestion.ts` (status enum, counters)
- `backend/src/modules/studentQuestions/repositories/StudentQuestionRepository.ts`
- `backend/src/modules/studentQuestions/controllers/StudentQuestionController.ts`
- Frontend: crowd-question answer + thumbs UI; instructor review queue.

---

## Future work: relevance + quality filter (required before re-enabling serving)

Disabling serving (2026-06-24) is a stopgap. Before crowd questions are shown
to students again, we need an **automated screening step** that filters out
meaningless submissions and verifies each question's **relevance to its source
context** (the preceding video segment / lesson). Only questions that pass this
screen should ever be served (or, depending on the gate design, surfaced to the
instructor queue).

Proposed pipeline position:

```
  submit ──► quality + relevance filter ──► (pass) ──► COLLECTING / served
                      │                                 (or instructor queue)
                      └──► (fail) ──► HELD / discarded (never served)
```

What the filter should check:

1. **Well-formedness / sense** — is it a coherent question with plausible,
   distinct options and a defensible correct answer? Reject gibberish,
   duplicate/empty options, and answers that don't follow from the question.
2. **Context relevance** — does the question actually pertain to the content of
   its `segmentId` video / lesson? Compare the question (and options) against
   the segment's transcript / title / lesson text; reject off-topic submissions.
3. **Safety / quality** — no spam, abuse, or PII (extends the existing
   `validateQuestionText` heuristics with semantic checks).

Likely implementation: an LLM-judge pass (see model guidance) scoring each
submission on sense + relevance against the segment context, producing a
`relevanceScore` / `qualityVerdict` persisted on the submission. Add a new
pre-serving state (e.g. `SCREENING` → `HELD` on fail) so only screened,
on-context questions enter the COLLECTING pool. Open: thresholds, whether the
filter feeds instructor-only review vs. re-enabled student serving, and how to
backfill-screen the already-submitted backlog.

---

## Open questions (need confirmation before implementation)

1. **"answered by at least 30% and at most 70%"** — interpreted here as
   **correct-answer rate** ∈ [30%, 70%]. Confirm this is correct vs. "30–70% of
   enrolled students *attempted* it."
2. ~~**Minimum sample size (N).**~~ **RESOLVED: `responseCount ≥ 200`**
   (`MIN_RESPONSES_FOR_GATE` in `services/crowdGate.ts`).
3. ~~**Thumbs-down denominator.**~~ **RESOLVED: out of all votes (👍+👎)** —
   `thumbsDownRate = thumbsDownCount / (thumbsUpCount + thumbsDownCount)`.
4. **Status enum** — add `COLLECTING` and `ELIGIBLE`, or reuse `PENDING` +
   an `eligibleForReview` boolean?
5. **Who sees crowd questions** — same cohort only? Exclude the author?
   One vote/answer per student enforced how?
6. **Non-graduating questions** — do COLLECTING questions that never pass the
   gate expire, get discarded, or live forever?
7. **Data migration** — the 208 already-submitted (currently PENDING +
   wrongly promoted) questions in *Fundamentals of AI – Summership 2026*:
   roll back their V1.1 promotions and move them into the Submitted QB?
