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

export interface MeaningfulVerdict {
  meaningful: boolean;
  reason: string;
}
export function asMeaningful(o: Record<string, unknown>): MeaningfulVerdict {
  if (!isBool(o.meaningful)) throw new VerdictSchemaError('meaningful');
  return {meaningful: o.meaningful, reason: str(o.reason)};
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
  correctIndex: number;
  confidence: Confidence;
  reason: string;
}
export function asAnswer(o: Record<string, unknown>): AnswerVerdict {
  const ci = typeof o.correctIndex === 'string' ? Number(o.correctIndex) : o.correctIndex;
  if (typeof ci !== 'number' || !Number.isInteger(ci) || ci < 0 || !isConf(o.confidence)) {
    throw new VerdictSchemaError('answer');
  }
  return {correctIndex: ci, confidence: o.confidence, reason: str(o.reason)};
}
