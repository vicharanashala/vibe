/**
 * Strict shapes for each check's LLM verdict + defensive validators.
 *
 * `response_format: json_object` only guarantees *valid JSON*, not the *right
 * keys*. So every verdict is validated against its expected shape; a mismatch
 * throws → the caller fails-closed (routes to HOLD) rather than trusting garbage.
 */

export type Confidence = 'high' | 'medium' | 'low';

const isBool = (v: unknown): v is boolean => typeof v === 'boolean';
const isConf = (v: unknown): v is Confidence => v === 'high' || v === 'medium' || v === 'low';
const str = (v: unknown): string => (typeof v === 'string' ? v : '');

export class VerdictSchemaError extends Error {
  constructor(what: string) {
    super(`screening verdict failed schema: ${what}`);
    this.name = 'VerdictSchemaError';
  }
}

/** Why a submission is (in)admissible. Kept distinct so `manipulation` — a student
 *  trying to steer the grader — is visible and alertable, not buried in "gibberish". */
export type AdmissibilityCategory =
  | 'ok'
  | 'manipulation'
  | 'junk'
  | 'not_a_question'
  | 'malformed';

const isCategory = (v: unknown): v is AdmissibilityCategory =>
  v === 'ok' ||
  v === 'manipulation' ||
  v === 'junk' ||
  v === 'not_a_question' ||
  v === 'malformed';

export interface AdmissibilityVerdict {
  category: AdmissibilityCategory;
  confidence: Confidence;
  reason: string;
  /** The question rewritten with obvious spelling typos fixed, or null if none. */
  corrected: string | null;
  /** Confidence in `corrected`. Only a 'high' typo is bounced back to the student. */
  typoConfidence: Confidence;
}
export function asAdmissible(o: Record<string, unknown>): AdmissibilityVerdict {
  if (!isCategory(o.category)) throw new VerdictSchemaError('category');
  // Fail-OPEN on a missing/garbled confidence: default to 'low' so an unreadable
  // reply routes to a human instead of hard-rejecting a possibly-good question.
  // (The rest of the pipeline degrades to HOLD on doubt; this must match.)
  const confidence = isConf(o.confidence) ? o.confidence : 'low';
  const corrected =
    typeof o.corrected === 'string' && o.corrected.trim() ? o.corrected.trim() : null;
  // Same reasoning: an unstated typo confidence must not bounce the student.
  const typoConfidence = isConf(o.typoConfidence) ? o.typoConfidence : 'low';
  return {category: o.category, confidence, reason: str(o.reason), corrected, typoConfidence};
}

export interface DuplicateVerdict {
  duplicate: boolean;
  confidence: Confidence;
  matchIndex: number | null; // index into the compared pool, or null
  reason: string;
}
export function asDuplicate(o: Record<string, unknown>): DuplicateVerdict {
  if (!isBool(o.duplicate) || !isConf(o.confidence)) throw new VerdictSchemaError('duplicate');
  const mi = o.matchIndex;
  const matchIndex = typeof mi === 'number' && Number.isInteger(mi) && mi >= 0 ? mi : null;
  return {duplicate: o.duplicate, confidence: o.confidence, matchIndex, reason: str(o.reason)};
}

export interface ContextVerdict {
  onTopic: boolean;
  confidence: Confidence;
  reason: string;
}
export function asContext(o: Record<string, unknown>): ContextVerdict {
  if (!isBool(o.onTopic) || !isConf(o.confidence)) throw new VerdictSchemaError('context');
  return {onTopic: o.onTopic, confidence: o.confidence, reason: str(o.reason)};
}

export interface AnswerVerdict {
  /** 0-based index of the correct option, or null = no/ambiguous correct option (route to human). */
  correctIndex: number | null;
  confidence: Confidence;
  reason: string;
}
export function asAnswer(o: Record<string, unknown>): AnswerVerdict {
  if (!isConf(o.confidence)) throw new VerdictSchemaError('answer');
  const raw = o.correctIndex;
  if (raw === null || raw === undefined) {
    return {correctIndex: null, confidence: o.confidence, reason: str(o.reason)};
  }
  const ci = typeof raw === 'string' ? Number(raw) : raw;
  if (typeof ci !== 'number' || !Number.isInteger(ci)) {
    throw new VerdictSchemaError('answer');
  }
  // Models sometimes signal "no correct option" as -1 instead of null — same meaning.
  if (ci < 0) {
    return {correctIndex: null, confidence: o.confidence, reason: str(o.reason)};
  }
  return {correctIndex: ci, confidence: o.confidence, reason: str(o.reason)};
}
