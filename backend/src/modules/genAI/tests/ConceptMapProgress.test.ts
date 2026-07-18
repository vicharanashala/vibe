import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { ConceptMapController } from '../controllers/ConceptMapController.js';
import { bktMastery } from '../services/bkt.js';

// Mastery-overlay join: published concept maps × the requesting student's
// quiz submissions → per-node 'mastered' | 'weak' outcomes plus a BKT
// mastery probability traced over the ordered answer history.

function makeController(
  maps: any[],
  quizOutcomes: Record<string, string>,
  answerSequences: Record<string, boolean[]> = {},
) {
  const conceptMapRepository = {
    getBySection: vi.fn(async () => maps),
  };
  const submissionRepository = {
    getOutcomesByQuizIds: vi.fn(async () => quizOutcomes),
    getAnswerSequencesByQuizIds: vi.fn(async () => answerSequences),
  };
  const controller = new ConceptMapController(
    {} as any,
    conceptMapRepository as any,
    submissionRepository as any,
  );
  return { controller, conceptMapRepository, submissionRepository };
}

const allow = { ability: { can: () => true }, user: { _id: 'u1' } } as any;
const deny = { ability: { can: () => false }, user: { _id: 'u1' } } as any;
const params = { versionId: 'v1', sectionId: 's1' } as any;

const MAP = {
  jobId: 'j1',
  nodes: [
    { id: 'c1', label: 'A', segmentEnd: 60, quizItemId: 'q1' },
    { id: 'c2', label: 'B', segmentEnd: 120, quizItemId: 'q2' },
    { id: 'c3', label: 'C', segmentEnd: 180, quizItemId: 'q3' },
    { id: 'c4', label: 'D', segmentEnd: 240 }, // segment got no quiz
  ],
  edges: [],
};

const round2 = (p: number) => Math.round(p * 100) / 100;

describe('ConceptMapController.getSectionProgress', () => {
  it('maps PASSED → mastered, ATTEMPTED → weak, and omits untouched nodes', async () => {
    const { controller, submissionRepository } = makeController(
      [MAP],
      { q1: 'PASSED', q2: 'ATTEMPTED' }, // q3 has no submissions
      { q1: [true, true], q2: [false] },
    );
    const result = await controller.getSectionProgress(params, allow);
    expect(result).toEqual([
      {
        jobId: 'j1',
        outcomes: { c1: 'mastered', c2: 'weak' },
        mastery: {
          c1: round2(bktMastery([true, true])), // 0.96
          c2: round2(bktMastery([false])), // 0.26
        },
      },
    ]);
    // one batched lookup with only the quiz-bearing nodes
    expect(submissionRepository.getOutcomesByQuizIds).toHaveBeenCalledWith(
      'u1',
      ['q1', 'q2', 'q3'],
    );
    expect(
      submissionRepository.getAnswerSequencesByQuizIds,
    ).toHaveBeenCalledWith('u1', ['q1', 'q2', 'q3']);
  });

  it('reports BKT mastery as a rounded probability in [0, 1]', async () => {
    const { controller } = makeController(
      [MAP],
      { q1: 'PASSED' },
      { q1: [false, true, true, true] },
    );
    const [entry] = (await controller.getSectionProgress(
      params,
      allow,
    )) as any[];
    expect(entry.mastery.c1).toBeGreaterThan(0);
    expect(entry.mastery.c1).toBeLessThanOrEqual(1);
    expect(entry.mastery.c1).toBe(round2(entry.mastery.c1));
  });

  it('returns empty outcomes for maps published before quizItemId existed', async () => {
    const legacyMap = {
      jobId: 'j0',
      nodes: [{ id: 'c1', label: 'A', segmentEnd: 60 }],
      edges: [],
    };
    const { controller, submissionRepository } = makeController([legacyMap], {});
    const result = await controller.getSectionProgress(params, allow);
    expect(result).toEqual([{ jobId: 'j0', outcomes: {}, mastery: {} }]);
    expect(submissionRepository.getOutcomesByQuizIds).toHaveBeenCalledWith(
      'u1',
      [],
    );
  });

  it('deduplicates quiz ids shared across nodes and maps', async () => {
    const twoMaps = [
      { jobId: 'j1', nodes: [{ id: 'c1', segmentEnd: 60, quizItemId: 'q1' }], edges: [] },
      { jobId: 'j2', nodes: [{ id: 'c1', segmentEnd: 60, quizItemId: 'q1' }], edges: [] },
    ];
    const { controller, submissionRepository } = makeController(
      twoMaps,
      { q1: 'PASSED' },
      { q1: [true] },
    );
    const result = await controller.getSectionProgress(params, allow);
    expect(submissionRepository.getOutcomesByQuizIds).toHaveBeenCalledWith(
      'u1',
      ['q1'],
    );
    expect(result).toEqual([
      { jobId: 'j1', outcomes: { c1: 'mastered' }, mastery: { c1: 0.8 } },
      { jobId: 'j2', outcomes: { c1: 'mastered' }, mastery: { c1: 0.8 } },
    ]);
  });

  it('rejects users without the View ability', async () => {
    const { controller } = makeController([MAP], {});
    await expect(controller.getSectionProgress(params, deny)).rejects.toThrow(
      /enrolled/,
    );
  });
});
