import {injectable} from 'inversify';
import {screeningConfig} from '#root/config/screening.js';
import {ScreeningLlm} from './ScreeningLlm.js';
import {createScreeningLlm} from './screeningLlmFactory.js';
import {localSpamCheck} from './localRules.js';
import {
  MEANINGFUL_PROMPT,
  DUPLICATE_PROMPT,
  CONTEXT_PROMPT,
  ANSWER_PROMPT,
} from './prompts.js';
import {asMeaningful, asDuplicate, asContext, asAnswer} from './verdicts.js';

export type ScreeningDecision = 'pass' | 'reject' | 'hold';

export type ScreeningReason =
  | 'ok'
  | 'too_short'
  | 'gibberish'
  | 'spam'
  | 'duplicate'
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
  /** Existing graded-QB question stems for this segment (the duplicate pool). */
  existingQuestions?: string[];
  /** Lesson context (title + transcript excerpt). Empty → context check skipped. */
  context?: string | null;
}

export interface ScreeningResult {
  decision: ScreeningDecision;
  reasonCode: ScreeningReason;
  /** Which specific check produced the decision. */
  check: 'local' | 'meaningful' | 'duplicate' | 'context' | 'answer' | 'none';
  /** Student-facing message. */
  message: string;
  /** Per-check booleans (surfaced to instructors / tuning). */
  checks: {wellFormed?: boolean; notDuplicate?: boolean; onTopic?: boolean; answerCorrect?: boolean};
  matchQuestion?: string;
  provider: string;
  model: string;
  latencyMs: number;
}

/**
 * Crowd-question screening filter.
 *
 * Runs the four checks in order, cheapest first, and STOPS at the first failure:
 *   1. well-formed / meaningful   (free local rules → then LLM)
 *   2. not a duplicate            (LLM, vs the segment's graded-QB pool)
 *   3. on-topic                   (LLM, vs the lesson transcript)
 *   4. answer correct (MCQ)       (LLM, last — most expensive)
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

  /** Test seam: inject a mock LLM without going through DI. */
  setLlm(llm: ScreeningLlm): this {
    this.llm = llm;
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
      return done({decision: 'reject', reasonCode: local.reasonCode, check: 'local', message: local.message, checks: {wellFormed: false}});
    }

    try {
      // ── 1b. meaningful (LLM) ──────────────────────────────────────────────
      const m = asMeaningful(await this.llm.askJson(MEANINGFUL_PROMPT(q)));
      if (!m.meaningful) {
        return done({decision: 'reject', reasonCode: 'gibberish', check: 'meaningful', message: "This doesn't look like a clear, answerable question. Please rephrase.", checks: {wellFormed: false}});
      }

      // ── 2. duplicate (LLM, vs graded-QB pool) ─────────────────────────────
      const pool = (input.existingQuestions ?? []).slice(0, screeningConfig.dedupPoolLimit);
      if (pool.length > 0) {
        const d = asDuplicate(await this.llm.askJson(DUPLICATE_PROMPT(q, pool)));
        if (d.duplicate) {
          const match = d.matchIndex != null ? pool[d.matchIndex] : undefined;
          // Confident duplicate → reject the student; unsure → hold for instructor.
          if (d.confidence === 'low') {
            return done({decision: 'hold', reasonCode: 'duplicate_uncertain', check: 'duplicate', message: 'Possibly similar to an existing question — sent for review.', checks: {wellFormed: true, notDuplicate: false}, matchQuestion: match});
          }
          return done({decision: 'reject', reasonCode: 'duplicate', check: 'duplicate', message: match ? `This looks like a duplicate of: "${match}"` : 'This looks like a duplicate of an existing question.', checks: {wellFormed: true, notDuplicate: false}, matchQuestion: match});
        }
      }

      // ── 3. on-topic (LLM, vs transcript) ──────────────────────────────────
      if (input.context && input.context.trim()) {
        const c = asContext(await this.llm.askJson(CONTEXT_PROMPT(q, input.context.trim())));
        if (!c.onTopic) {
          if (c.confidence === 'low') {
            return done({decision: 'hold', reasonCode: 'off_topic', check: 'context', message: 'Relevance to this lesson is unclear — sent for review.', checks: {wellFormed: true, notDuplicate: true, onTopic: false}});
          }
          return done({decision: 'reject', reasonCode: 'off_topic', check: 'context', message: "This question doesn't seem related to this lesson. Please submit it on the relevant video.", checks: {wellFormed: true, notDuplicate: true, onTopic: false}});
        }
      }

      // ── 4. answer correctness (LLM, last) ─────────────────────────────────
      const opts = input.options ?? [];
      if (opts.length >= 2 && Number.isInteger(input.correctOptionIndex)) {
        const a = asAnswer(await this.llm.askJson(ANSWER_PROMPT(q, opts, input.context ?? undefined)));
        if (a.correctIndex !== input.correctOptionIndex) {
          // Unsure disagreement → hold; confident disagreement → reject to fix.
          if (a.confidence === 'low') {
            return done({decision: 'hold', reasonCode: 'answer_uncertain', check: 'answer', message: 'The correct answer is ambiguous — sent for review.', checks: {wellFormed: true, notDuplicate: true, onTopic: true, answerCorrect: false}});
          }
          return done({decision: 'reject', reasonCode: 'wrong_answer', check: 'answer', message: 'The option you marked correct looks wrong. Please review the answer.', checks: {wellFormed: true, notDuplicate: true, onTopic: true, answerCorrect: false}});
        }
      }

      // ── all checks passed ─────────────────────────────────────────────────
      return done({decision: 'pass', reasonCode: 'ok', check: 'none', message: 'Looks good — submitted for review.', checks: {wellFormed: true, notDuplicate: true, onTopic: true, answerCorrect: true}});
    } catch (err) {
      // Fail-CLOSED: never crash a submission. Route to manual review.
      console.warn('[screening] failed, holding for manual review:', (err as Error)?.message);
      return done({decision: 'hold', reasonCode: 'screen_unavailable', check: 'none', message: "We couldn't fully check your question right now — it's been sent for review.", checks: {}});
    }
  }
}
