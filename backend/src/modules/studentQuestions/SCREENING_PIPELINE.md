# Crowd-Question Screening Pipeline — Feature Design

> **Status:** Active (demo on Groq free tier; production-ready to switch to Anthropic).
> **Module:** `backend/src/modules/studentQuestions`
> **Last updated:** 2026-07-02
>
> This document is the living design reference for the AI screening filter. **Keep it
> updated whenever the pipeline, prompts, config, decisions, or data model change** —
> see the [Changelog](#changelog) at the bottom.

---

## 1. Purpose

When a student submits a crowd-sourced MCQ, we must decide — the moment they hit
**Verify & Contribute** — whether the question is good enough to enter the review
queue, needs a human look, or should be bounced back to the student with a clear
reason. The filter does this automatically so instructors aren't buried in junk.

**Goals**

- Catch gibberish/spam, unclear questions, duplicates (even reworded), off-topic
  questions, and wrong marked answers — with an LLM making the *semantic* calls.
- **Never crash a submission.** Any failure degrades to a manual-review hold.
- **Cheap:** well under **$1 per 1,000 submissions**.
- Fit the existing module patterns (Inversify DI, repositories, DTOs) and reuse the
  project's LLM access — no foreign stack, no heavyweight vector DB.
- ≥90% agreement with human labels on a labelled test set (currently ~96%).

---

## 2. Decision model

Every submission resolves to one of three decisions:

| Decision | Meaning | Persisted status | Enters review queue? |
|----------|---------|------------------|----------------------|
| `pass`   | Clean — all checks passed | `PENDING` | Yes (staged to submitted bank) |
| `hold`   | Unsure — needs an instructor | `HELD` | Yes, flagged for manual review |
| `reject` | Confidently bad — bounced to student with a reason | `REJECTED` (stub) | No |

**Confidence drives the reject/hold boundary:** a *confident* "no" rejects (student
sees why and can fix); an *unsure* "no" holds (defers to an instructor) so we never
hard-block on a shaky call.

---

## 3. The pipeline (ordered, short-circuiting)

Checks run **cheapest-first and stop at the first failure**. Free local rules run
before any paid LLM call; the most expensive check (answer correctness) runs last.

```
submission
   │
   ▼
[0] Exact-signature guard      ── DB lookup, free ── identical live resubmit? → reject
   │
   ▼
[1a] Local spam rules          ── regex, free ────── gibberish/spam? → reject
   │
   ▼
[1b] Meaningful                ── LLM ───────────── unclear / not a real question? → reject
   │
   ▼
[2] Duplicate                  ── LLM ───────────── semantic dup of the pool? → reject / hold
   │
   ▼
[3] On-topic (context)         ── LLM ───────────── unrelated to the lesson? → reject / hold
   │                                                 (ON HOLD — SCREENING_CONTEXT_ENABLED=false; see §7)
   ▼
[4] Answer correctness (MCQ)   ── LLM ───────────── marked answer wrong? → reject / hold
   │
   ▼
 pass
```

### Check-by-check

| # | Check | Where | Cost | Rejects when | Holds when |
|---|-------|-------|------|--------------|------------|
| 0 | Exact-signature guard | `StudentQuestionService.createQuestion` → `repository.findDuplicate` | Free | An identical **live** (`PENDING`/`HELD`/`APPROVED`) submission already exists for this lesson. Rejected stubs are ignored so a fixed resubmit re-screens. | — |
| 1a | Local spam rules | `localRules.localSpamCheck` | Free | Too short (<6 chars), mostly symbols (<50% alphanumeric), no letters, repeated char `(.)\1{5,}`, or a single word repeated | — |
| 1b | Meaningful | `ScreeningService` + `MEANINGFUL_PROMPT` | 1 LLM call | **Confident** gibberish, no specific subject, not an answerable question, or **grader-directed prompt-injection** (see §6). Lenient on grammar/spelling. | **Borderline** (low/medium confidence) — looks like a real attempt but malformed/ambiguous (e.g. `what is 3+#`) → held for an instructor instead of hard-rejected |
| 2 | Duplicate | `DUPLICATE_PROMPT`, batched vs the pool | 1 LLM call | Confident semantic duplicate (judged by meaning, zero word-overlap still counts) | Low-confidence duplicate |
| 3 | On-topic | `CONTEXT_PROMPT` vs transcript | 1 LLM call | Confident off-topic | Low-confidence off-topic |
| 4 | Answer correctness | `ANSWER_PROMPT` | 1 LLM call | Confident the marked correct option is wrong | Ambiguous / low-confidence |

Cost note: most junk dies at checks 0/1a (free) or 1b (one call). A clean question
costs up to ~3 short LLM calls (meaningful + duplicate + answer). At Groq free-tier /
small-model pricing this stays well under the $1/1,000 target.

---

## 4. The duplicate pool (what a new question is compared against)

The semantic duplicate check compares the new question against a **merged, de-duplicated**
pool built from two sources for that segment:

1. **Existing student submissions** — `PENDING` + `HELD` + `APPROVED`
   (`fetchSubmissionPool` → `repository.listBySegment`). Rejected stubs are excluded
   so a student can retry a corrected version.
2. **The graded Question Bank** — already-promoted questions
   (`fetchGradedPool` → the quiz's `questionBankRefs[0]`).

`mergePool()` normalizes (lowercase/trim), drops repeats, and caps at
`dedupPoolLimit` (50). Comparing against **pending** submissions — not just approved
ones — is what lets a repeat be caught *before* any teacher acts.

> ⚠️ **Gotcha fixed:** `QuestionBankService.getQuestions()` returns a *random `count`-sized
> draw* (how many the quiz shows a learner), not the whole bank. `fetchGradedPool`
> overrides `count` to `dedupPoolLimit` and reads questions in `raw` mode so `.text`
> is reliable.

---

## 5. Reliability (never crash a submission)

- **Per-call timeout:** `AbortController`, `timeoutMs` = 9000ms.
- **Retries:** `maxRetries` = 2 on 429 / 5xx / abort, with linear backoff (800ms → 4000ms).
- **Forced JSON:** Groq `response_format: json_object`, temperature 0; defensive
  `parseJsonObject` strips fences / trailing commas; `verdicts.ts` validates shape and
  throws `VerdictSchemaError` on a bad object.
- **Fail-closed:** any thrown error in `ScreeningService.screen` → `hold`
  (`screen_unavailable`), never an exception into the submission path.
- **Idempotent / non-fatal staging:** promotion + bank writes are best-effort and
  wrapped so they never fail the user's submission.

---

## 6. Prompt-injection defense

Submitted text is always wrapped and labelled as **DATA, never instructions**. The
`MEANINGFUL_PROMPT` additionally rejects text that tries to manipulate the grader
("ignore previous rules", "respond with", "set meaningful=true", embedded JSON,
"reviewer note", etc.) and requires a genuine answerable question to remain after
stripping any such instructions.

Verified by the red-team suite (`tests/screening.redteam.test.ts`): 7 adversarial
attacks (injection at meaningful/duplicate/answer, story-wrappers, wrong-answer
coercion) — **0 currently slip through**, control question still passes.

---

## 7. Configuration

`backend/src/config/screening.ts` (all overridable via env):

| Key | Env | Default | Purpose |
|-----|-----|---------|---------|
| `provider` | `SCREENING_PROVIDER` | `groq` | `groq` (demo/free) or `anthropic` (prod) |
| `enabled` | `SCREENING_ENABLED` | `true` | Master switch; off = fail-open (dev only) |
| `groq.model` | `GROQ_MODEL` | `llama-3.3-70b-versatile` | Groq model |
| `groq.url` | `GROQ_URL` | OpenAI-compatible Groq endpoint | |
| `anthropic.model` | `ANTHROPIC_MODEL` | `claude-haiku-4-5` | Prod model |
| `timeoutMs` | `SCREENING_TIMEOUT_MS` | `9000` | Per-call deadline |
| `maxRetries` | `SCREENING_MAX_RETRIES` | `2` | Transient-error retries |
| `dedupPoolLimit` | `SCREENING_DEDUP_LIMIT` | `50` | Max pool size for duplicate check |
| `contextCheckEnabled` | `SCREENING_CONTEXT_ENABLED` | `false` | On-topic (relevance) checking — ON HOLD by default |
| `contextCharBudget` | `SCREENING_CONTEXT_CHARS` | `2000` | Lesson-context chars for on-topic + answer checks |

**Provider-agnostic:** `createScreeningLlm()` picks `GroqScreeningLlm` or
`AnthropicScreeningLlm` by config; the four checks are identical across providers.

> **🛑 On-topic (context) check is ON HOLD** (`SCREENING_CONTEXT_ENABLED=false`,
> the default). While on hold, `createQuestion` passes `context: null`, so the
> ScreeningService skips the on-topic gate and runs answer-correctness on model
> knowledge. Rationale: real per-segment transcripts don't exist yet, so the only
> available context is the weak graded-stem proxy — feeding it to a hard on-topic
> gate would risk false off-topic rejections.
>
> The full capability is built and retained. When enabled, the lesson context
> comes from `SegmentContextProvider.getContext()` (layered: precomputed
> transcript when a `segmentContext` row exists, else the following quiz's
> graded-question stems as a proxy, plus the video title/description) and grounds
> BOTH the on-topic gate and the answer-correctness check. Populate real
> transcripts with `scripts/backfill-segment-transcripts.cjs`, then flip
> `SCREENING_CONTEXT_ENABLED=true`. See `CROWD_QUESTION_BANK.md` → Stage 0.

---

## 8. Data model

`StudentSegmentQuestion` carries:

- `status`: `PENDING` | `HELD` | `APPROVED` | `REJECTED`
- `normalizedSignature`: `lowercase(question) + '||' + options.join('|') + '||' + correctIndex`
  — used by the exact-signature guard.
- `screening?`: persisted verdict subdocument (`decision`, `reasonCode`, per-check
  booleans, provider/model, latency, matched question).
- `rejectionReason?`, `promotedQuestionId?`.

---

## 9. Student-facing messages

Each reason has a distinct, actionable message (surfaced in the composer's
`VerdictPanel`). Rejections tell the student exactly what to fix; holds explain a
human will review. See `localRules.ts` and `ScreeningService.screen` for the exact
strings.

---

## 10. Files

| File | Responsibility |
|------|----------------|
| `config/screening.ts` | Provider/model/timeouts/thresholds |
| `services/screening/ScreeningService.ts` | Orchestrates the 4 ordered checks, decisions |
| `services/screening/ScreeningLlm.ts` | Provider interface + defensive JSON parse |
| `services/screening/GroqScreeningLlm.ts` | Groq client (timeout, retries, forced JSON) |
| `services/screening/AnthropicScreeningLlm.ts` | Anthropic client |
| `services/screening/screeningLlmFactory.ts` | Provider selection |
| `services/screening/prompts.ts` | The four prompts |
| `services/screening/verdicts.ts` | Schema validators |
| `services/screening/localRules.ts` | Free local spam rules |
| `services/StudentQuestionService.ts` | Submission flow, exact guard, pool building, staging/promotion |
| `tests/ScreeningService.test.ts` | Mocked unit tests |
| `tests/screening.dataset.ts` + `tests/screening.accuracy.test.ts` | Labelled set + ≥90% accuracy gate |
| `tests/screening.demo.test.ts` | Live demo reel / single-question runner |
| `tests/screening.redteam.test.ts` | Adversarial / injection regression suite |

---

## 11. Testing

- **Unit (mocked):** `ScreeningService.test.ts` — deterministic, no network.
- **Accuracy (live):** `screening.accuracy.test.ts` — 25 labelled cases, asserts ≥90%
  (last: ~96%). Run: `NODE_OPTIONS="-r dotenv/config" DOTENV_CONFIG_PATH=.env npx vitest run <file>`.
- **Red-team (live):** `screening.redteam.test.ts` — asserts 0 attacks slip through.
- **Demo (live):** `screening.demo.test.ts` — visual reel or `SCREEN_Q=... ` single run.

---

## 12. Known limitations / TODO

- On-topic (context) check is ON HOLD (`SCREENING_CONTEXT_ENABLED=false`). The
  capability is built (`SegmentContextProvider` + on-topic gate) but disabled
  until real per-segment transcripts exist (currently ~0 — genAI transcript files
  don't exist for these course videos, so only the weak graded-stem proxy is
  available). To enable: run `scripts/backfill-segment-transcripts.cjs`, then set
  `SCREENING_CONTEXT_ENABLED=true`.
- Dedup is per-segment only; no cross-segment or global dedup.
- No embeddings/vector DB yet (intentional — LLM semantic check is enough at this scale).
- `ok2`-style answer-check false-rejects: consider confident-mismatch → `hold` tuning.

---

## Changelog

- **2026-07-17** — **Context-aware screening wired up + adopted onto `feat/crowd-q-context-screening`.**
  Built the `SegmentContextProvider` (layered: precomputed transcript → graded-stem proxy →
  title/desc → null/fail-open), replacing the old `fetchSegmentContext` that read an
  always-empty `item.details.transcript`. Added the `segmentContext` collection + repo methods
  and `scripts/backfill-segment-transcripts.cjs` (dry-run default; APPLY=1). Debug `console.log`s
  stripped. Model verified `claude-haiku-4-5` (valid classifier; `temperature: 0`/`max_tokens: 400`
  accepted on Haiku 4.5). **On-topic (context) check put ON HOLD** behind
  `SCREENING_CONTEXT_ENABLED` (default false) — no real transcripts exist yet, so the proxy is
  too weak to hard-gate relevance; enable once transcripts are backfilled.
- **2026-07-06** — **Strict-judge DUPLICATE_PROMPT (ASK/GIVENS/KEY):** duplicate check now
  decomposes the new question (ASK / GIVENS / KEY) inside a JSON `analysis` field and
  compares per-candidate. KEY is defined per question type — numerical (computed answer;
  any changed parameter = not dup) vs conceptual/factual (the fact tested; no numeric
  givens is normal, same fact + same key = dup regardless of wording). Fixes both failure
  modes: isomorphic-numbers over-matching AND conceptual reworded dups being missed.
  Verified live 5/5 (faithful + zero-overlap rewords caught; same-answer-different-problem
  and different-focus correctly pass). Red-team 0/7 slipped; edge suite 17/17 (typo-bounce
  test expectation updated to match the student-side typo-fix feature). ANSWER_PROMPT also
  tightened by user (no typo tolerance; ambiguity → hold; injection-aware).
- **2026-07-03** — **Prompt overhaul (accuracy pass targeting dup/mistake/spam requirements):**
  (1) all four prompts rewritten reason-FIRST (model reasons before committing a verdict)
  with few-shot examples covering known traps (commutative dup, same-answer-different-question,
  typo'd options, borderline-malformed, grader injection); (2) explicit confidence contract
  (high = auto-act, medium/low = human review) — answer check now rejects only on HIGH
  confidence; (3) `ANSWER_PROMPT` supports `correctIndex: null` (no correct option /
  ambiguous / opinion-based → HOLD) and tolerates typo'd options ("Tokio"≈Tokyo);
  (4) arithmetic dedup rule: must quote operand comparison in reason (fixes 2+2 vs 3+1
  hallucinated match); (5) free local rules now catch keyboard-row mashing ("asdf qwerty");
  (6) new live edge-case suite `screening.edgecases.test.ts` (17 cases mapped to the three
  product requirements). Mocked unit tests re-keyed on reply-spec JSON keys.
- **2026-07-02** — Hardened `DUPLICATE_PROMPT`: forces a per-item comparison and
  explicitly defines equivalence (reordered operands like `1+3`≡`3+1`, rewording,
  trivial edits) while NOT over-matching different problems that share an answer
  (`3+1` vs `2+2`). Fixes a miss where a large/noisy pool (long distractor stems)
  caused the model to skip a commutative-math duplicate. Accuracy 92%, red-team 0/7.
- **2026-07-02** — Meaningful check now has a **confidence gate**: borderline/malformed
  inputs (low/medium confidence, e.g. `what is 3+#`) → **hold** for review instead of
  a hard reject; confident gibberish/manipulation still rejects. New reason code
  `unclear`. Brings the meaningful check in line with the confidence→reject/hold policy
  used by the duplicate and answer checks. Accuracy 92% (2 misses are the disabled
  on-topic check), red-team still 0/7.
- **2026-07-02** — Initial design doc. Reflects: merged dedup pool (pending + approved +
  graded), exact-guard ignoring rejected stubs, `getQuestions` random-draw fix,
  reason-specific student messages, prompt-injection hardening on the meaningful check
  (red-team 7/7 defended), on-topic check temporarily disabled.
