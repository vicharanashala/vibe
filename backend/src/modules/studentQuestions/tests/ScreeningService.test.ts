/**
 * Unit tests for ScreeningService with a MOCKED LLM.
 *
 * Deterministic, no API key, CI-safe. Verifies the pipeline WIRING — ordering,
 * short-circuit, decision mapping, confidence→reject/hold, schema-fail and
 * provider-fail both degrading to HOLD (fail-closed). The *accuracy* of the real
 * model is measured separately by scripts/screening-accuracy.ts.
 */
import {describe, it, expect} from 'vitest';
import {ScreeningService} from '../services/screening/ScreeningService.js';
import {ScreeningLlm} from '../services/screening/ScreeningLlm.js';

/** Mock LLM: routes each check to a canned verdict by inspecting the prompt. */
function mockLlm(handler: (prompt: string) => Record<string, unknown>, spy?: (p: string) => void): ScreeningLlm {
  return {
    provider: 'mock',
    model: 'mock',
    async askJson(prompt: string) {
      spy?.(prompt);
      return handler(prompt);
    },
  };
}

const which = (p: string) =>
  /meaningful=false/.test(p) ? 'meaningful'
  : /DUPLICATE of ANY/.test(p) ? 'duplicate'
  : /on-topic/.test(p) ? 'context'
  : /0-based index/.test(p) ? 'answer'
  : 'unknown';

const svc = (llm: ScreeningLlm) => new ScreeningService().setLlm(llm);

// A handler where every LLM check passes.
const allPass = (p: string): Record<string, unknown> => {
  switch (which(p)) {
    case 'meaningful': return {meaningful: true, reason: 'ok'};
    case 'duplicate': return {duplicate: false, confidence: 'high', matchIndex: null, reason: 'unique'};
    case 'context': return {onTopic: true, confidence: 'high', reason: 'relevant'};
    case 'answer': return {correctIndex: 0, confidence: 'high', reason: 'A'};
    default: return {};
  }
};

describe('ScreeningService (mocked LLM)', () => {
  it('rejects symbol-gibberish via local rules WITHOUT calling the LLM', async () => {
    let called = false;
    // symbol-heavy → caught by free local rules (alphanumeric keyboard-mashing
    // like "r5ytrwe..." is caught by the LLM meaningful check instead).
    const r = await svc(mockLlm(allPass, () => (called = true))).screen({questionText: '@@@ !!! ### $$$'});
    expect(r.decision).toBe('reject');
    expect(r.check).toBe('local');
    expect(called).toBe(false);
  });

  it('rejects when the LLM says not meaningful', async () => {
    const r = await svc(mockLlm(() => ({meaningful: false, reason: 'too vague'}))).screen({questionText: 'what is that'});
    expect(r.decision).toBe('reject');
    expect(r.check).toBe('meaningful');
  });

  it('rejects a high-confidence duplicate against the graded pool', async () => {
    const r = await svc(mockLlm(p => which(p) === 'duplicate'
      ? {duplicate: true, confidence: 'high', matchIndex: 0, reason: 'same meaning'}
      : allPass(p),
    )).screen({questionText: 'describe ai', existingQuestions: ['what is the meaning of ai']});
    expect(r.decision).toBe('reject');
    expect(r.reasonCode).toBe('duplicate');
    expect(r.matchQuestion).toBe('what is the meaning of ai');
  });

  it('HOLDS a low-confidence duplicate (defers to instructor)', async () => {
    const r = await svc(mockLlm(p => which(p) === 'duplicate'
      ? {duplicate: true, confidence: 'low', matchIndex: 0, reason: 'maybe'}
      : allPass(p),
    )).screen({questionText: 'describe ai', existingQuestions: ['what is the meaning of ai']});
    expect(r.decision).toBe('hold');
    expect(r.reasonCode).toBe('duplicate_uncertain');
  });

  it('rejects an off-topic question (confident)', async () => {
    const r = await svc(mockLlm(p => which(p) === 'context'
      ? {onTopic: false, confidence: 'high', reason: 'about football'}
      : allPass(p),
    )).screen({questionText: 'offside rule?', context: 'Intro to AI'});
    expect(r.decision).toBe('reject');
    expect(r.reasonCode).toBe('off_topic');
  });

  it('rejects a wrong marked answer (confident)', async () => {
    const r = await svc(mockLlm(p => which(p) === 'answer'
      ? {correctIndex: 0, confidence: 'high', reason: 'Tokyo'}
      : allPass(p),
    )).screen({questionText: 'capital of japan', options: ['Tokyo', 'Beijing'], correctOptionIndex: 1});
    expect(r.decision).toBe('reject');
    expect(r.reasonCode).toBe('wrong_answer');
  });

  it('passes a clean, unique, on-topic question with a correct answer', async () => {
    const r = await svc(mockLlm(allPass)).screen({
      questionText: 'what is supervised learning',
      options: ['A defn', 'wrong'],
      correctOptionIndex: 0,
      existingQuestions: ['what is ai'],
      context: 'Intro to AI',
    });
    expect(r.decision).toBe('pass');
    expect(r.reasonCode).toBe('ok');
  });

  it('fail-CLOSED to hold when the provider throws', async () => {
    const r = await svc(mockLlm(() => {
      throw new Error('provider down');
    })).screen({questionText: 'a perfectly fine question about ai'});
    expect(r.decision).toBe('hold');
    expect(r.reasonCode).toBe('screen_unavailable');
  });

  it('fail-CLOSED to hold when the LLM returns an off-schema verdict', async () => {
    const r = await svc(mockLlm(() => ({wrong: 'shape'}))).screen({questionText: 'a fine question about ai'});
    expect(r.decision).toBe('hold');
    expect(r.reasonCode).toBe('screen_unavailable');
  });
});
