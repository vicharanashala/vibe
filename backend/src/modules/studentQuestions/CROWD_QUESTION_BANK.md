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

> 🛑 **CURRENT STATE (as of 2026-07-17): crowd questions are NOT YET served to
> students** — serving is still disabled in code
> (`AttemptService._getQuestionsForAttempt` does not append a COLLECTING
> question). The serving helpers (`_findPrecedingVideoSegments`,
> `_pickCollectingQuestion`, `_adaptStudentQuestionToRenderView`) are retained
> but dormant.
>
> ✅ **AGREED TARGET WORKFLOW (2026-07-17).** Serving is re-enabled, but **only
> behind an LLM-judge screen** that runs first (new **Stage 0**, below). The
> judge validates each submission against the source-video **transcript** on two
> axes: **(1) context relevance** — is the question actually about that segment's
> content? — and **(2) answer-key correctness** — does the marked correct option
> actually follow from the transcript? Only questions that pass BOTH are then
> served to *other* students as an **ungraded** item, where each student
> **answers** it and gives a **thumbs up / thumbs down**. The judge fixes the two
> things peer voting never could — off-topic/gibberish screening and an
> independently-verified answer key — so the peer `correctRate` / thumbs signal
> is meaningful rather than confounded. Instructor approval remains the final
> gate into the graded bank.

---

## V3 lifecycle

```
  ┌──────────┐  submit   ┌──────────────────────────────┐
  │ Student  │ ────────► │  STAGE 0: LLM-JUDGE SCREEN    │  vs. source-video transcript
  │ submits  │           │   • context relevance         │
  └──────────┘           │   • answer-key correctness     │
                         └──────┬────────────────┬───────┘
                          pass  │                │  fail
                                ▼                ▼
                          ┌─────────────────────┐   HELD / discarded
                          │  SUBMITTED QB        │   (never served)
                          │  status: COLLECTING  │   (separate, ungraded bank)
                          └──────────┬──────────┘
                                     │ shown to OTHER students as an
                                     │ ungraded item: answer + 👍/👎
                                     ▼
                          ┌─────────────────────┐
                          │  Peer-validation     │  accumulate until
                          │  gate (responseCount │   responseCount ≥ 200, then:
                          │  ≥ 200, then check)   │   - correctRate ∈ [0.30,0.70]
                          └──────────┬──────────┘   - thumbsDownRate < 0.10
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

- **SCREENING** — just submitted; awaiting the Stage-0 LLM-judge pass. Not in
  any bank yet; never served.
- **HELD** — failed the judge screen (off-topic, incoherent, unsafe, or the
  marked answer is not supported by the transcript). Never served; may be
  surfaced to the instructor as rejected-with-reason.
- **COLLECTING** — passed the judge screen; lives in the Submitted QB (separate
  bank). Ungraded. Served to *other* students alongside (or after) the normal
  quiz, who can **answer it** and give a **thumbs up / thumbs down**.
- **ELIGIBLE** — reached `responseCount ≥ 200` and passed the difficulty-band +
  thumbs gate; enqueued for instructor review.
- **APPROVED** — instructor approved; promoted into the graded quiz question
  bank and counts toward assessment.
- **REJECTED** — instructor rejected; removed from rotation.

(Existing enum is `PENDING | APPROVED | REJECTED`; V3 needs at minimum
`SCREENING` / `HELD` / `COLLECTING` / `ELIGIBLE` distinctions — see Open
questions.)

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
- **🆕 Stage-0 LLM-judge screen (NOT built — agreed 2026-07-17).** New on-submit
  step that validates context relevance + answer-key correctness against the
  segment transcript (see "Stage 0" below). Gates entry into COLLECTING; also run
  as a one-time backfill over the 788-question backlog.
- **🔁 Serve crowd questions to students (currently DISABLED; to be re-enabled
  behind Stage 0).** `AttemptService._getQuestionsForAttempt` **currently** does
  not append a COLLECTING crowd question. The serving helpers
  (`_pickCollectingQuestion`: fewest-responses-first, excludes the author and
  already-answered; plus `_findPrecedingVideoSegments` /
  `_adaptStudentQuestionToRenderView`) and the `peerCorrectLotItemId` capture
  plumbing remain in place but dormant. Re-enable so that **only Stage-0-passed
  (COLLECTING)** questions are served ungraded for answer + 👍/👎.
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

## Stage 0: LLM-judge screening — relevance + answer-key correctness (AGREED 2026-07-17)

This is a **required first stage**, not deferred work. Every submission is
screened by an LLM judge **before** it is ever served to a student, and serving
is re-enabled only for submissions that pass. The judge reads the source-video
**transcript** (resolved via `segmentId`) plus the segment title / lesson text.

> 🛑 **IMPLEMENTATION STATUS (2026-07-17): the relevance/on-topic check is ON HOLD.**
> Stage 0 is built and live on `feat/crowd-q-context-screening`, but its
> **context (on-topic relevance) check is gated off** by `SCREENING_CONTEXT_ENABLED=false`
> — real per-segment transcripts don't exist yet, so the only available context is
> the weak graded-question-stem proxy, which would risk false off-topic rejections.
> The other checks (well-formedness, duplicate, answer-key correctness on model
> knowledge) run now. Re-enable relevance by backfilling transcripts
> (`scripts/backfill-segment-transcripts.cjs`) and flipping the flag; that also
> grounds the answer-key check in the lesson. See `SCREENING_PIPELINE.md` §7.

Pipeline position:

```
  submit ──► Stage-0 LLM-judge screen ──► (pass) ──► COLLECTING (served ungraded)
                      │
                      └──► (fail) ──► HELD / discarded (never served)
```

What the judge checks:

1. **Context relevance** — does the question (and its options) actually pertain
   to the content of its `segmentId` segment? Compare against the transcript;
   reject off-topic submissions.
2. **Answer-key correctness** — treat the transcript as ground truth and verify
   the submitter's marked `correctOptionIndex` is genuinely correct. The judge
   independently answers the question from the transcript; if its answer
   disagrees with the marked key, the submission fails (or is routed to the
   instructor flagged with the judge's suggested key — see Open q. 9). This is
   the check peer voting can never provide, and the reason the downstream
   `correctRate` signal is trustworthy rather than confounded by a wrong key.
3. **Well-formedness / sense** — coherent question, plausible + distinct
   options, no gibberish, no duplicate/empty options.
4. **Safety** — no spam, abuse, or PII (extends the existing `validateQuestionText`
   heuristics with semantic checks).

Outcome: a submission that passes all four moves to **COLLECTING** (enters the
Submitted QB and becomes servable). Any failure moves it to **HELD** (never
served). Persist the judge verdict on the submission — e.g. `relevanceScore`,
`keyVerdict` / `judgeAnswerIndex`, `qualityVerdict`, `screenState`.

Likely implementation: one LLM-judge call per submission (latest Claude model
per model guidance) returning a structured verdict. Run it **on-submit** for new
questions, and as a **one-time backfill pass over the 788 already-collected
submissions** so the existing backlog is screened before any of it is served.

Open: score thresholds; key-mismatch handling (auto-reject vs. instructor-flag,
Open q. 9); how to handle segments whose transcript is missing / low quality.

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
8. **Gate threshold vs. cohort size.** `MIN_RESPONSES_FOR_GATE = 200` is
   unreachable on the courses that currently have submission enabled (5 and 10
   learners; `responseCount` = 0 across all 788 collected to date). Confirm we
   keep 200 (peer-validation only meaningfully runs on large cohorts; small
   pilots effectively rely on Stage-0 judge + instructor), or scale the
   threshold to enrollment.
9. **Key-mismatch handling.** When the Stage-0 judge disagrees with the marked
   answer: auto-reject to HELD, or keep + flag for the instructor with the
   judge's suggested key?
