import {describe, it, expect} from 'vitest';
import {StudentQuestionService} from '../services/StudentQuestionService.js';

/**
 * Regression: a question that PASSES screening but cannot be staged into a quiz
 * bank (no quiz after the video, no bank, DB error) used to be reported to the
 * student as "Contributed!" while never reaching any quiz. It must now be held
 * for instructor review and reported honestly.
 */

function makeService(itemRepo: any) {
  const held: string[] = [];
  const repository: any = {
    findDuplicate: async () => null,
    listBySegment: async () => [],
    create: async () => 'created-id',
    setPromotedQuestionId: async () => {},
    markHeld: async (id: string) => {
      held.push(id);
    },
  };
  const settingRepo: any = {
    readCourseSettings: async () => ({
      settings: {crowdsourcedQuestionSubmissionEnabled: true},
    }),
  };
  const screeningService: any = {
    screen: async () => ({
      decision: 'pass',
      reasonCode: 'ok',
      check: 'all',
      message: 'looks good',
      checks: {},
      provider: 'stub',
      model: 'stub',
      latencyMs: 1,
    }),
  };
  const service = new StudentQuestionService(
    repository,
    settingRepo,
    {} as any,
    {} as any,
    {} as any,
    itemRepo,
    screeningService,
    {getContext: async () => null} as any,
    {} as any,
  );
  return {service, held};
}

const input = {
  courseId: '64c000000000000000000010',
  courseVersionId: '64c000000000000000000011',
  segmentId: '64c000000000000000000012',
  questionType: 'SELECT_ONE_IN_LOT' as const,
  questionText: 'Which planet is closest to the sun?',
  options: [{text: 'Mercury'}, {text: 'Venus'}, {text: 'Earth'}],
  correctOptionIndex: 0,
  createdBy: '64c000000000000000000013',
};

describe('createQuestion — staging failure', () => {
  it('holds a passed question that has no target quiz instead of claiming success', async () => {
    // readItemById → null: no quiz can be resolved, so staging returns null.
    const {service, held} = makeService({readItemById: async () => null});

    const result = await service.createQuestion(input);

    expect(result.decision).toBe('hold');
    expect(result.reasonCode).toBe('staging_unavailable');
    expect(result.questionId).toBe('created-id');
    expect(held).toEqual(['created-id']);
  });
});
