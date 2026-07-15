import {injectable} from 'inversify';
import {screeningConfig} from '#root/config/screening.js';
import {ScreeningLlm} from './ScreeningLlm.js';
import {createScreeningLlm} from './screeningLlmFactory.js';
import {localSpamCheck} from './localRules.js';
import {
  SINGLE_PASS_PROMPT,
  ADMISSIBILITY_PROMPT,
  DUPLICATE_PROMPT,
  CONTEXT_PROMPT,
  ANSWER_PROMPT,
} from './prompts.js';
import {asAdmissible, asSinglePass, asDuplicate, asContext, asAnswer} from './verdicts.js';
import {VectorDedupService} from './VectorDedupService.js';
import {QuestionVectorRepository} from '../../repositories/providers/mongodb/QuestionVectorRepository.js';

export type ScreeningDecision = 'pass' | 'reject' | 'hold';

export type ScreeningReason =
  | 'ok'
  | 'too_short'
  | 'gibberish'
  | 'not_a_question'
  /** The submission tried to instruct the grader (prompt injection). */
  | 'manipulation'
  | 'unclear'
  | 'typo'
  | 'spam'
  | 'duplicate'
  /** Vector fast-path: near-identical to an existing question. Student may appeal. */
  | 'duplicate_similar'
  | 'off_topic'
  | 'wrong_answer'
  | 'answer_uncertain'
  | 'duplicate_uncertain'
  | 'screen_unavailable';

export interface ScreeningInput {
  questionText: string;
  /** Option texts (0-based). Empty/omitted → answer check is skipped. */
  options?: string[];
  correctOptionIndex?: number | null;
  /** Lesson segment — scopes the vector search (a duplicate is always same-segment). */
  segmentId?: string;
  /** Existing graded-QB question stems. Only used when vector search is unavailable. */
  existingQuestions?: string[];
  /** Lesson context (title + transcript excerpt). Empty → context check skipped. */
  context?: string | null;
  /**
   * The student is appealing a `duplicate_similar` rejection ("I think this is
   * different"). Retrieval still runs, but the cosine fast-path is disabled and the
   * LLM judge decides — its verdict is final, so there is nothing further to appeal.
   */
  appealed?: boolean;
}

export interface ScreeningResult {
  decision: ScreeningDecision;
  reasonCode: ScreeningReason;
  /** Which specific check produced the decision. */
  check: 'local' | 'admissible' | 'duplicate' | 'context' | 'answer' | 'none';
  /** Student-facing message. */
  message: string;
  /**
   * The model's own one-line justification. Persisted so an instructor reviewing a
   * HELD question sees *why* it was held, not just a bare reason code.
   */
  reason?: string;
  /** Per-check booleans (surfaced to instructors / tuning). */
  checks: {admissible?: boolean; notDuplicate?: boolean; onTopic?: boolean; answerCorrect?: boolean};
  matchQuestion?: string;
  /**
   * True only on a `duplicate_similar` reject: the cosine fast-path is a heuristic,
   * not a verdict, so the student is offered one re-submission that goes to the LLM
   * judge instead. Drives the "this isn't a duplicate — have it reviewed" button.
   */
  appealable?: boolean;
  /** Cosine of the closest existing question — for tuning the thresholds on real traffic. */
  similarity?: number;
  /** For a `typo` bounce: the question with spelling fixed, so the student can one-tap apply it. */
  suggestedFix?: string;
  provider: string;
  model: string;
  latencyMs: number;
}

/**
 * Crowd-question screening filter.
 *
 * Runs the four checks in order, cheapest first, and STOPS at the first failure:
 *   1. admissible                 (free local rules → then LLM on the FAST model)
 *   2. not a duplicate            (LLM, vs the segment's graded-QB pool)
 *   3. on-topic                   (LLM, vs the lesson context)
 *   4. answer correct (MCQ)       (LLM, last — most expensive)
 *
 * Only check 1 runs on every submission, so it rides the small/cheap model; the
 * three judgement-heavy checks use the reasoning model. Groq meters its free tier
 * per model, so this split roughly doubles the pipeline's daily throughput.
 *
 * Reliability (brief §6): every LLM call has a timeout + retries; on ANY failure
 * the submission is never crashed — it degrades to `hold` (needs manual review).
 * Confidence drives the reject/hold boundary: a confident "no" blocks the student,
 * an unsure call defers to an instructor.
 */
@injectable()
export class ScreeningService {
  // Built from config at construction (no network). Overridable for tests.
  private llm: ScreeningLlm = createScreeningLlm();

  // Same story: constructing it opens no connection and loads no model — both are
  // lazy — so this stays newable in tests while DI still binds the real singleton.
  private vectors: VectorDedupService = new VectorDedupService(
    new QuestionVectorRepository(),
  );

  /** Test seam: inject a mock LLM without going through DI. */
  setLlm(llm: ScreeningLlm): this {
    this.llm = llm;
    return this;
  }

  /** Test seam: inject a stub vector stage without going through DI. */
  setVectors(v: VectorDedupService): this {
    this.vectors = v;
    return this;
  }

  async screen(input: ScreeningInput): Promise<ScreeningResult> {
    const start = Date.now();
    const base = {provider: this.llm.provider, model: this.llm.model};
    const done = (r: Omit<ScreeningResult, 'provider' | 'model' | 'latencyMs'>): ScreeningResult => ({
      ...r,
      ...base,
      latencyMs: Date.now() - start,
    });

    // If screening is disabled (dev), pass everything through untouched.
    if (!screeningConfig.enabled) {
      return done({decision: 'pass', reasonCode: 'ok', check: 'none', message: 'Screening disabled.', checks: {}});
    }

    const q = input.questionText;

    // ── 1a. free local rules ────────────────────────────────────────────────
    const local = localSpamCheck(q);
    if (local) {
      return done({decision: 'reject', reasonCode: local.reasonCode, check: 'local', message: local.message, checks: {admissible: false}});
    }

    if (screeningConfig.singlePass) {
      return this.screenSinglePass(input, q, done);
    }

    try {
      // ── 1b. admissibility gate (LLM, FAST model) ──────────────────────────
      // Runs on every submission, so it rides the small/cheap model: it is a
      // mechanical classification, not a judgement call. It is also the layer
      // that catches grader manipulation, before any prompt carrying the
      // student's text reaches the reasoning judges downstream.
      //
      // That ordering is not cosmetic. The vector stage can now SKIP the duplicate
      // check when nothing in the bank is close — and the duplicate judge is what
      // used to catch grader-directed text, by accident. Injection has to die here,
      // at a gate that always runs, or it dies nowhere.
      const a = asAdmissible(await this.llm.askJson(ADMISSIBILITY_PROMPT(q), 'fast'));

      if (a.category === 'manipulation') {
        // Always reject, regardless of confidence: a submission that instructs the
        // grader has no legitimate reading. Logged (not silently binned) so we can
        // see whether students are probing the filter.
        console.warn('[screening] manipulation attempt rejected:', {reason: a.reason});
        return done({decision: 'reject', reasonCode: 'manipulation', check: 'admissible', reason: a.reason, message: 'Your submission contains instructions aimed at the review system rather than a question. Please submit only the question itself.', checks: {admissible: false}});
      }

      // `malformed` is a genuine attempt we cannot parse — always a human. And any
      // other rejectable verdict we are NOT confident about is a human's call too:
      // never hard-block a student on doubt (the duplicate/answer checks do the same).
      if (a.category === 'malformed' || (a.category !== 'ok' && a.confidence !== 'high')) {
        return done({decision: 'hold', reasonCode: 'unclear', check: 'admissible', reason: a.reason, message: 'Your question was a little hard to read automatically, so an instructor will review it before it’s added.', checks: {admissible: false}});
      }

      if (a.category === 'junk') {
        return done({decision: 'reject', reasonCode: 'gibberish', check: 'admissible', reason: a.reason, message: "This doesn't read as a clear, answerable question. Please rewrite it as a complete question with a specific thing being asked.", checks: {admissible: false}});
      }
      if (a.category === 'not_a_question') {
        return done({decision: 'reject', reasonCode: 'not_a_question', check: 'admissible', reason: a.reason, message: "This doesn't ask anything. Please rewrite it as a complete question with a specific thing being asked.", checks: {admissible: false}});
      }

      // ── 1c. typo bounce ───────────────────────────────────────────────────
      // Obvious spelling mistake → send it back to the STUDENT to fix (with the
      // correction pre-filled), so instructors never have to clean up typos.
      // Only on a CONFIDENT typo: a wrong "correction" of a domain term or a name
      // would bounce a perfectly good question. Ignore case/whitespace-only diffs.
      const norm = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase();
      if (a.corrected && a.typoConfidence === 'high' && norm(a.corrected) !== norm(q)) {
        return done({decision: 'reject', reasonCode: 'typo', check: 'admissible', reason: a.reason, message: `Looks like a spelling typo — did you mean: "${a.corrected}"? Fix it and resubmit.`, checks: {admissible: true}, suggestedFix: a.corrected});
      }

      // ── 2. duplicate — RETRIEVE (vectors) then JUDGE (LLM) ────────────────
      // Vectors do recall, the LLM does precision. Cosine alone cannot decide this
      // (see VectorDedupService): it barely encodes negation, so "which is NOT a
      // type of ML" sits ~0.92 against "which IS a type of ML". Hence the fast-path
      // rejection below is appealable, and everything else defers to the judge.
      let pool: string[] = [];
      if (input.segmentId) {
        const vec = await this.vectors.findSimilar(
          input.segmentId,
          q,
          !input.appealed, // an appeal disables the fast path; only the LLM may decide
        );
        switch (vec.kind) {
          case 'auto_reject':
            return done({
              decision: 'reject',
              reasonCode: 'duplicate_similar',
              check: 'duplicate',
              message: `This looks like a question that already exists for this lesson: "${vec.match.text}". If you think yours asks something different, you can have it reviewed.`,
              checks: {admissible: true, notDuplicate: false},
              matchQuestion: vec.match.text,
              similarity: vec.match.cosine,
              appealable: true,
            });
          case 'no_candidates':
            pool = []; // nothing plausible in the bank — skip the LLM call entirely
            break;
          case 'candidates':
            pool = vec.hits.map(h => h.text);
            break;
          case 'unavailable':
            // Vector store off/broken → fall back to the original blind pool, so a
            // misconfigured cluster degrades cost, never correctness.
            pool = (input.existingQuestions ?? []).slice(0, screeningConfig.dedupPoolLimit);
            break;
        }
      } else {
        pool = (input.existingQuestions ?? []).slice(0, screeningConfig.dedupPoolLimit);
      }

      if (pool.length > 0) {
        const d = asDuplicate(await this.llm.askJson(DUPLICATE_PROMPT(q, pool)));
        if (d.duplicate) {
          const match = d.matchIndex != null ? pool[d.matchIndex] : undefined;
          // Confident duplicate → reject the student; unsure → hold for instructor.
          if (d.confidence === 'low') {
            return done({decision: 'hold', reasonCode: 'duplicate_uncertain', check: 'duplicate', message: match ? `This may overlap with an existing question ("${match}"). An instructor will review it before it's added.` : 'This may overlap with an existing question, so an instructor will review it before it’s added.', checks: {admissible: true, notDuplicate: false}, matchQuestion: match});
          }
          return done({decision: 'reject', reasonCode: 'duplicate', check: 'duplicate', message: match ? `This question already exists for this lesson: "${match}". Try asking about a different point instead.` : 'This question already exists for this lesson. Try asking about a different point instead.', checks: {admissible: true, notDuplicate: false}, matchQuestion: match});
        }
      }

      // ── 3. on-topic (LLM, vs transcript) ──────────────────────────────────
      if (input.context && input.context.trim()) {
        const c = asContext(await this.llm.askJson(CONTEXT_PROMPT(q, input.context.trim())));
        if (!c.onTopic) {
          if (c.confidence === 'low') {
            return done({decision: 'hold', reasonCode: 'off_topic', check: 'context', message: 'Relevance to this lesson is unclear — sent for review.', checks: {admissible: true, notDuplicate: true, onTopic: false}});
          }
          return done({decision: 'reject', reasonCode: 'off_topic', check: 'context', message: "This question doesn't seem related to this lesson. Please ask something about what the video actually covers.", checks: {admissible: true, notDuplicate: true, onTopic: false}});
        }
      }

      // ── 4. answer correctness (LLM, last) ─────────────────────────────────
      const opts = input.options ?? [];
      if (opts.length >= 2 && Number.isInteger(input.correctOptionIndex)) {
        const a = asAnswer(await this.llm.askJson(ANSWER_PROMPT(q, opts, input.context ?? undefined)));
        // null = LLM says NO option is correct / multiple correct / ambiguous.
        // Confident → bounce back to the STUDENT to fix the options (teachers
        // shouldn't clean this up); unsure → the rare genuinely-debatable case
        // goes to an instructor.
        if (a.correctIndex === null) {
          if (a.confidence === 'high') {
            return done({decision: 'reject', reasonCode: 'wrong_answer', check: 'answer', message: 'None of your options is a correct answer to this question. Please fix the options (or the question) and resubmit.', checks: {admissible: true, notDuplicate: true, onTopic: true, answerCorrect: false}});
          }
          return done({decision: 'hold', reasonCode: 'answer_uncertain', check: 'answer', message: 'The correct answer here seems debatable, so an instructor will review your question before it’s added.', checks: {admissible: true, notDuplicate: true, onTopic: true, answerCorrect: false}});
        }
        if (a.correctIndex !== input.correctOptionIndex) {
          // Unsure disagreement → hold; confident disagreement → reject to fix.
          if (a.confidence !== 'high') {
            return done({decision: 'hold', reasonCode: 'answer_uncertain', check: 'answer', message: "We couldn't confirm which option is correct, so an instructor will review your question before it's added.", checks: {admissible: true, notDuplicate: true, onTopic: true, answerCorrect: false}});
          }
          return done({decision: 'reject', reasonCode: 'wrong_answer', check: 'answer', message: 'The option you marked as correct appears to be wrong. Please re-check your options and select the right answer.', checks: {admissible: true, notDuplicate: true, onTopic: true, answerCorrect: false}});
        }
      }

      // ── all checks passed ─────────────────────────────────────────────────
      return done({decision: 'pass', reasonCode: 'ok', check: 'none', message: 'Looks good — your question passed all checks and has been submitted.', checks: {admissible: true, notDuplicate: true, onTopic: true, answerCorrect: true}});
    } catch (err) {
      // Fail-CLOSED: never crash a submission. Route to manual review.
      console.warn('[screening] failed, holding for manual review:', (err as Error)?.message);
      return done({decision: 'hold', reasonCode: 'screen_unavailable', check: 'none', message: "We couldn't finish the automatic checks right now, so an instructor will review your question before it's added.", checks: {}});
    }
  }

  /**
   * Every check in ONE LLM call.
   *
   * Identical decision rules to the three-call path — only the number of requests
   * changes, and requests are the resource that actually runs out. The vector stage
   * still runs first: it is free, it can reject or clear a submission without the
   * model, and it decides which candidates the single prompt has to weigh.
   */
  private async screenSinglePass(
    input: ScreeningInput,
    q: string,
    done: (r: Omit<ScreeningResult, 'provider' | 'model' | 'latencyMs'>) => ScreeningResult,
  ): Promise<ScreeningResult> {
    try {
      // ── vector stage (free) ───────────────────────────────────────────────
      let candidates: string[] = [];
      if (input.segmentId) {
        const vec = await this.vectors.findSimilar(input.segmentId, q, !input.appealed);
        switch (vec.kind) {
          case 'auto_reject':
            return done({
              decision: 'reject',
              reasonCode: 'duplicate_similar',
              check: 'duplicate',
              message: `This looks like a question that already exists for this lesson: "${vec.match.text}". If you think yours asks something different, you can have it reviewed.`,
              checks: {admissible: true, notDuplicate: false},
              matchQuestion: vec.match.text,
              similarity: vec.match.cosine,
              appealable: true,
            });
          case 'candidates':
            candidates = vec.hits.map(h => h.text);
            break;
          case 'no_candidates':
            break; // nothing plausible — the prompt just gets an empty list
          case 'unavailable':
            candidates = (input.existingQuestions ?? []).slice(0, screeningConfig.dedupPoolLimit);
            break;
        }
      } else {
        candidates = (input.existingQuestions ?? []).slice(0, screeningConfig.dedupPoolLimit);
      }

      const opts = input.options ?? [];
      const v = asSinglePass(
        await this.llm.askJson(SINGLE_PASS_PROMPT(q, opts, candidates, input.context)),
      );

      // ── 1. admissibility ──────────────────────────────────────────────────
      // Manipulation is judged on its own terms and always rejected: a submission
      // that instructs the grader has no legitimate reading, whatever else it says.
      if (v.category === 'manipulation') {
        console.warn('[screening] manipulation attempt rejected:', {reason: v.reason});
        return done({decision: 'reject', reasonCode: 'manipulation', check: 'admissible', reason: v.reason, message: 'Your submission contains instructions aimed at the review system rather than a question. Please submit only the question itself.', checks: {admissible: false}});
      }
      if (v.category === 'malformed' || (v.category !== 'ok' && v.confidence !== 'high')) {
        return done({decision: 'hold', reasonCode: 'unclear', check: 'admissible', reason: v.reason, message: 'Your question was a little hard to read automatically, so an instructor will review it before it’s added.', checks: {admissible: false}});
      }
      if (v.category === 'junk') {
        return done({decision: 'reject', reasonCode: 'gibberish', check: 'admissible', reason: v.reason, message: "This doesn't read as a clear, answerable question. Please rewrite it as a complete question with a specific thing being asked.", checks: {admissible: false}});
      }
      if (v.category === 'not_a_question') {
        return done({decision: 'reject', reasonCode: 'not_a_question', check: 'admissible', reason: v.reason, message: "This doesn't ask anything. Please rewrite it as a complete question with a specific thing being asked.", checks: {admissible: false}});
      }

      // ── 2. typo bounce (confident typos only) ─────────────────────────────
      const norm = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase();
      if (v.corrected && v.typoConfidence === 'high' && norm(v.corrected) !== norm(q)) {
        return done({decision: 'reject', reasonCode: 'typo', check: 'admissible', reason: v.reason, message: `Looks like a spelling typo — did you mean: "${v.corrected}"? Fix it and resubmit.`, checks: {admissible: true}, suggestedFix: v.corrected});
      }

      // ── 3. duplicate ──────────────────────────────────────────────────────
      if (v.duplicateIndex !== null && candidates.length > 0) {
        const match = candidates[v.duplicateIndex];
        if (v.duplicateConfidence !== 'high') {
          return done({decision: 'hold', reasonCode: 'duplicate_uncertain', check: 'duplicate', reason: v.reason, message: match ? `This may overlap with an existing question ("${match}"). An instructor will review it before it's added.` : 'This may overlap with an existing question, so an instructor will review it before it’s added.', checks: {admissible: true, notDuplicate: false}, matchQuestion: match});
        }
        return done({decision: 'reject', reasonCode: 'duplicate', check: 'duplicate', reason: v.reason, message: match ? `This question already exists for this lesson: "${match}". Try asking about a different point instead.` : 'This question already exists for this lesson. Try asking about a different point instead.', checks: {admissible: true, notDuplicate: false}, matchQuestion: match});
      }

      // ── 4. on-topic (only meaningful when we actually know the lesson) ────
      if (input.context && input.context.trim() && !v.onTopic) {
        if (v.topicConfidence !== 'high') {
          return done({decision: 'hold', reasonCode: 'off_topic', check: 'context', reason: v.reason, message: 'Relevance to this lesson is unclear — sent for review.', checks: {admissible: true, notDuplicate: true, onTopic: false}});
        }
        return done({decision: 'reject', reasonCode: 'off_topic', check: 'context', reason: v.reason, message: "This question doesn't seem related to this lesson. Please ask something about what the video actually covers.", checks: {admissible: true, notDuplicate: true, onTopic: false}});
      }

      // ── 5. answer correctness ─────────────────────────────────────────────
      if (opts.length >= 2 && Number.isInteger(input.correctOptionIndex)) {
        if (v.correctIndex === null) {
          if (v.answerConfidence === 'high') {
            return done({decision: 'reject', reasonCode: 'wrong_answer', check: 'answer', reason: v.reason, message: 'None of your options is a correct answer to this question. Please fix the options (or the question) and resubmit.', checks: {admissible: true, notDuplicate: true, answerCorrect: false}});
          }
          return done({decision: 'hold', reasonCode: 'answer_uncertain', check: 'answer', reason: v.reason, message: 'The correct answer here seems debatable, so an instructor will review your question before it’s added.', checks: {admissible: true, notDuplicate: true, answerCorrect: false}});
        }
        if (v.correctIndex !== input.correctOptionIndex) {
          if (v.answerConfidence !== 'high') {
            return done({decision: 'hold', reasonCode: 'answer_uncertain', check: 'answer', reason: v.reason, message: "We couldn't confirm which option is correct, so an instructor will review your question before it's added.", checks: {admissible: true, notDuplicate: true, answerCorrect: false}});
          }
          return done({decision: 'reject', reasonCode: 'wrong_answer', check: 'answer', reason: v.reason, message: 'The option you marked as correct appears to be wrong. Please re-check your options and select the right answer.', checks: {admissible: true, notDuplicate: true, answerCorrect: false}});
        }
      }

      return done({decision: 'pass', reasonCode: 'ok', check: 'none', reason: v.reason, message: 'Looks good — your question passed all checks and has been submitted.', checks: {admissible: true, notDuplicate: true, onTopic: true, answerCorrect: true}});
    } catch (err) {
      // Fail-OPEN, as everywhere: a broken provider must never lose a submission.
      console.warn('[screening] failed, holding for manual review:', (err as Error)?.message);
      return done({decision: 'hold', reasonCode: 'screen_unavailable', check: 'none', message: "We couldn't finish the automatic checks right now, so an instructor will review your question before it's added.", checks: {}});
    }
  }
}
