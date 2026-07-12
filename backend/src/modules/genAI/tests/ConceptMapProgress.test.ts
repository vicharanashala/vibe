import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { ConceptMapController } from '../controllers/ConceptMapController.js';

// Mastery-overlay join: published concept maps × the requesting student's
// quiz submissions → per-node 'mastered' | 'weak' outcomes.

function makeController(maps: any[], quizOutcomes: Record<string, string>) {
  const conceptMapRepository = {
    getBySection: vi.fn(async () => maps),
  };
  const submissionRepository = {
    getOutcomesByQuizIds: vi.fn(async () => quizOutcomes),
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

describe('ConceptMapController.getSectionProgress', () => {
  it('maps PASSED → mastered, ATTEMPTED → weak, and omits untouched nodes', async () => {
    const { controller, submissionRepository } = makeController([MAP], {
      q1: 'PASSED',
      q2: 'ATTEMPTED',
      // q3 has no submissions
    });
    const result = await controller.getSectionProgress(params, allow);
    expect(result).toEqual([
      { jobId: 'j1', outcomes: { c1: 'mastered', c2: 'weak' } },
    ]);
    // one batched lookup with only the quiz-bearing nodes
    expect(submissionRepository.getOutcomesByQuizIds).toHaveBeenCalledWith(
      'u1',
      ['q1', 'q2', 'q3'],
    );
  });

  it('returns empty outcomes for maps published before quizItemId existed', async () => {
    const legacyMap = {
      jobId: 'j0',
      nodes: [{ id: 'c1', label: 'A', segmentEnd: 60 }],
      edges: [],
    };
    const { controller, submissionRepository } = makeController([legacyMap], {});
    const result = await controller.getSectionProgress(params, allow);
    expect(result).toEqual([{ jobId: 'j0', outcomes: {} }]);
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
    const { controller, submissionRepository } = makeController(twoMaps, {
      q1: 'PASSED',
    });
    const result = await controller.getSectionProgress(params, allow);
    expect(submissionRepository.getOutcomesByQuizIds).toHaveBeenCalledWith(
      'u1',
      ['q1'],
    );
    expect(result).toEqual([
      { jobId: 'j1', outcomes: { c1: 'mastered' } },
      { jobId: 'j2', outcomes: { c1: 'mastered' } },
    ]);
  });

  it('rejects users without the View ability', async () => {
    const { controller } = makeController([MAP], {});
    await expect(controller.getSectionProgress(params, deny)).rejects.toThrow(
      /enrolled/,
    );
  });
});
