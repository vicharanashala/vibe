/**
 * Vector de-duplication — logic tests with a STUBBED store and embedder.
 *
 * Deterministic, no Atlas, no model download, CI-safe. These cover everything the
 * cluster is NOT needed for: the score→cosine conversion, the threshold branching,
 * the appeal path, fail-open, and how ScreeningService routes each outcome.
 *
 * NOT covered here (and it must not be claimed as covered): `$vectorSearch` itself.
 * It is an Atlas-only aggregation stage — mongodb-memory-server cannot run it — so
 * the real query is exercised against a live cluster, not from this file.
 */
import {describe, it, expect} from 'vitest';
import {VectorDedupService} from '../services/screening/VectorDedupService.js';
import {QuestionVectorRepository, VectorHit} from '../repositories/providers/mongodb/QuestionVectorRepository.js';
import {ScreeningService} from '../services/screening/ScreeningService.js';
import {ScreeningLlm} from '../services/screening/ScreeningLlm.js';
import {EmbeddingProvider} from '../services/screening/embeddings/EmbeddingProvider.js';
import {screeningConfig} from '#root/config/screening.js';

const SEGMENT = '64b000000000000000000001';

/** Embedder that never touches a model — the vectors are irrelevant to the stub store. */
const stubEmbedder: EmbeddingProvider = {
  model: 'stub',
  dims: 3,
  embed: async (texts: string[]) => texts.map(() => [1, 0, 0]),
};

/** Store that returns whatever hits the test dictates. */
function stubStore(hits: VectorHit[], opts: {count?: number; throws?: boolean} = {}) {
  return {
    isConfigured: () => true,
    countForSegment: async () => opts.count ?? hits.length,
    search: async () => {
      if (opts.throws) throw new Error('atlas down');
      return hits;
    },
    upsert: async () => {},
  } as unknown as QuestionVectorRepository;
}

const dedup = (hits: VectorHit[], opts?: {count?: number; throws?: boolean}) =>
  new VectorDedupService(stubStore(hits, opts)).setEmbedder(stubEmbedder);

const hit = (text: string, cosine: number): VectorHit => ({questionId: 'q1', text, cosine});

describe('QuestionVectorRepository score conversion', () => {
  it('converts an Atlas score back to raw cosine', () => {
    // Atlas normalises cosine to (1 + cos) / 2. Getting this wrong would make a
    // 0.93 threshold really fire at cosine 0.86 — a flood of false rejects.
    const toCosine = (QuestionVectorRepository as any).toCosine as (s: number) => number;
    expect(toCosine(0.965)).toBeCloseTo(0.93, 5); // the auto-reject threshold
    expect(toCosine(1.0)).toBeCloseTo(1.0, 5); // identical
    expect(toCosine(0.5)).toBeCloseTo(0.0, 5); // orthogonal
  });
});

describe('VectorDedupService', () => {
  const {autoRejectAt, llmFloorAt} = screeningConfig.vector;

  it('auto-rejects a near-identical question (fast path)', async () => {
    const r = await dedup([hit('what is supervised learning', autoRejectAt + 0.01)])
      .findSimilar(SEGMENT, 'what is supervised learning?');
    expect(r.kind).toBe('auto_reject');
    if (r.kind === 'auto_reject') expect(r.match.text).toBe('what is supervised learning');
  });

  it('does NOT auto-reject on appeal — the LLM must decide', async () => {
    const r = await dedup([hit('which IS a type of ML', autoRejectAt + 0.01)])
      .findSimilar(SEGMENT, 'which is NOT a type of ML', /* allowAutoReject */ false);
    // The whole point: a negated question scores near-identical, so an appeal has
    // to reach the judge rather than being bounced again by the same heuristic.
    expect(r.kind).toBe('candidates');
  });

  it('skips the LLM entirely when nothing is even plausibly related', async () => {
    const r = await dedup([hit('unrelated question', llmFloorAt - 0.1)])
      .findSimilar(SEGMENT, 'what is a neural network');
    expect(r.kind).toBe('no_candidates');
  });

  it('skips the LLM when the segment has no questions yet', async () => {
    const r = await dedup([], {count: 0}).findSimilar(SEGMENT, 'first question ever');
    expect(r.kind).toBe('no_candidates');
  });

  it('hands only the plausible candidates to the judge (noise is dropped)', async () => {
    const r = await dedup([
      hit('close one', 0.85),
      hit('also close', 0.70),
      hit('noise', llmFloorAt - 0.2),
    ]).findSimilar(SEGMENT, 'a question');
    expect(r.kind).toBe('candidates');
    if (r.kind === 'candidates') {
      expect(r.hits.map(h => h.text)).toEqual(['close one', 'also close']);
    }
  });

  it('fails OPEN when the vector store breaks', async () => {
    const r = await dedup([], {count: 5, throws: true}).findSimilar(SEGMENT, 'a question');
    expect(r.kind).toBe('unavailable');
  });
});

/** LLM that passes every check — lets us assert on what the vector stage did. */
function passingLlm(spy?: (prompt: string) => void): ScreeningLlm {
  return {
    provider: 'mock',
    model: 'mock',
    modelFor: () => 'mock',
    async askJson(prompt: string) {
      spy?.(prompt);
      if (prompt.includes('"category"')) return {category: 'ok', confidence: 'high', reason: 'ok', corrected: null, typoConfidence: 'low'};
      if (prompt.includes('"duplicate"')) return {duplicate: false, confidence: 'high', matchIndex: null, reason: 'unique'};
      if (prompt.includes('"onTopic"')) return {onTopic: true, confidence: 'high', reason: 'ok'};
      if (prompt.includes('"correctIndex"')) return {correctIndex: 0, confidence: 'high', reason: 'ok'};
      return {};
    },
  };
}

describe('ScreeningService × vector stage', () => {
  const {autoRejectAt} = screeningConfig.vector;

  it('rejects on the fast path, and marks it APPEALABLE with the matched question', async () => {
    const svc = new ScreeningService()
      .setLlm(passingLlm())
      .setVectors(dedup([hit('what is the boiling point of water', autoRejectAt + 0.02)]));

    const r = await svc.screen({
      questionText: 'at what temperature does water boil',
      segmentId: SEGMENT,
    });

    expect(r.decision).toBe('reject');
    expect(r.reasonCode).toBe('duplicate_similar');
    expect(r.appealable).toBe(true);
    expect(r.matchQuestion).toBe('what is the boiling point of water');
    expect(r.similarity).toBeGreaterThanOrEqual(autoRejectAt);
  });

  it('an appeal skips the fast path and reaches the LLM judge', async () => {
    let dupPromptSeen = false;
    const svc = new ScreeningService()
      .setLlm(passingLlm(p => {
        if (p.includes('"duplicate"')) dupPromptSeen = true;
      }))
      .setVectors(dedup([hit('which IS a type of ML', autoRejectAt + 0.05)]));

    const r = await svc.screen({
      questionText: 'which of these is NOT a type of ML',
      segmentId: SEGMENT,
      appealed: true,
    });

    expect(dupPromptSeen).toBe(true); // the judge was actually consulted
    expect(r.decision).toBe('pass'); // and it cleared the question
    expect(r.appealable).toBeUndefined(); // the judge's verdict is final — no second appeal
  });

  it('does not call the LLM duplicate check when nothing is close', async () => {
    let dupPromptSeen = false;
    const svc = new ScreeningService()
      .setLlm(passingLlm(p => {
        if (p.includes('"duplicate"')) dupPromptSeen = true;
      }))
      .setVectors(dedup([hit('nothing alike', 0.1)]));

    const r = await svc.screen({questionText: 'a brand new question', segmentId: SEGMENT});

    expect(dupPromptSeen).toBe(false); // the reasoning-model call was saved
    expect(r.decision).toBe('pass');
  });

  it('falls back to the blind pool when the vector store is unavailable', async () => {
    let dupPromptSeen = false;
    const svc = new ScreeningService()
      .setLlm(passingLlm(p => {
        if (p.includes('"duplicate"')) dupPromptSeen = true;
      }))
      .setVectors(dedup([], {count: 5, throws: true}));

    const r = await svc.screen({
      questionText: 'a question',
      segmentId: SEGMENT,
      existingQuestions: ['an existing question'],
    });

    // A broken cluster degrades cost, never correctness — the judge still runs.
    expect(dupPromptSeen).toBe(true);
    expect(r.decision).toBe('pass');
  });
});
