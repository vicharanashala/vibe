import {describe, it, expect, afterEach} from 'vitest';
import {StudentQuestionService} from '../services/StudentQuestionService.js';
import {screeningConfig} from '#root/config/screening.js';

/**
 * End-to-end wiring test for the context-aware screening change: verifies that
 * `createQuestion` resolves lesson context via SegmentContextProvider and passes
 * it into `ScreeningService.screen(...)` ONLY when context checking is enabled
 * (SCREENING_CONTEXT_ENABLED) — it is ON HOLD by default — and that a non-pass
 * verdict is NOT staged into the submitted bank.
 *
 * All collaborators are stubbed; the screening client is a spy that records the
 * `context` it was handed.
 */

function makeService(overrides: {
  screenSpy: (input: any) => void;
  contextValue: string | null;
  decision?: 'pass' | 'hold' | 'reject';
}) {
  const decision = overrides.decision ?? 'hold';

  const repository: any = {
    findDuplicate: async () => null,
    listBySegment: async () => [],
    create: async () => 'created-id',
    setPromotedQuestionId: async () => {},
  };
  const settingRepo: any = {
    readCourseSettings: async () => ({
      settings: {crowdsourcedQuestionSubmissionEnabled: true},
    }),
  };
  const notificationService: any = {};
  const questionService: any = {};
  const questionBankService: any = {};
  // itemRepo.readItemById → null keeps _resolveTargetQuiz / fetchGradedPool empty.
  const itemRepo: any = {readItemById: async () => null};

  const screeningService: any = {
    screen: async (input: any) => {
      overrides.screenSpy(input);
      return {
        decision,
        reasonCode: decision === 'pass' ? 'ok' : 'off_topic',
        check: 'context',
        message: 'stub verdict',
        checks: {},
        provider: 'stub',
        model: 'stub',
        latencyMs: 1,
      };
    },
  };
  const segmentContextProvider: any = {
    getContext: async () => overrides.contextValue,
  };

  return new StudentQuestionService(
    repository,
    settingRepo,
    notificationService,
    questionService,
    questionBankService,
    itemRepo,
    screeningService,
    segmentContextProvider,
  );
}

const baseInput = {
  courseId: '64c000000000000000000010',
  courseVersionId: '64c000000000000000000011',
  segmentId: '64c000000000000000000012',
  questionType: 'SELECT_ONE_IN_LOT' as const,
  questionText: 'Which planet is closest to the sun?',
  options: [{text: 'Mercury'}, {text: 'Venus'}, {text: 'Earth'}],
  correctOptionIndex: 0,
  createdBy: '64c000000000000000000013',
};

describe('createQuestion — context wiring', () => {
  const originalFlag = screeningConfig.contextCheckEnabled;
  afterEach(() => {
    screeningConfig.contextCheckEnabled = originalFlag;
  });

  it('feeds provider context into screen() when context checking is ENABLED', async () => {
    screeningConfig.contextCheckEnabled = true;
    let seen: any = null;
    const service = makeService({
      screenSpy: input => {
        seen = input;
      },
      contextValue: 'Lesson: Solar System\nTopics covered in this lesson...',
      decision: 'hold',
    });

    const result = await service.createQuestion(baseInput);

    expect(seen).not.toBeNull();
    expect(seen.context).toBe('Lesson: Solar System\nTopics covered in this lesson...');
    expect(seen.questionText).toBe(baseInput.questionText);
    expect(seen.correctOptionIndex).toBe(0);
    // hold → persisted (HELD) with a questionId, but not a reject.
    expect(result.decision).toBe('hold');
    expect(result.questionId).toBe('created-id');
  });

  it('withholds context (ON HOLD) when context checking is DISABLED', async () => {
    screeningConfig.contextCheckEnabled = false;
    let seen: any = null;
    const service = makeService({
      screenSpy: input => {
        seen = input;
      },
      // Provider would return context, but createQuestion must not call it.
      contextValue: 'SHOULD_NOT_REACH_SCREEN',
      decision: 'reject',
    });

    const result = await service.createQuestion(baseInput);

    // Context is withheld — the on-topic gate is skipped, screening still runs.
    expect(seen.context).toBeNull();
    // reject → no questionId surfaced to the student.
    expect(result.decision).toBe('reject');
    expect(result.questionId).toBeUndefined();
  });
});
