import {describe, it, expect, vi} from 'vitest';
import {StudentQuestionService} from '../services/StudentQuestionService.js';

/**
 * Unit tests for `recordPeerResponse`, the Stage-2 capture entry point:
 * record the response, then resolve the enrollment-scaled gate threshold and
 * flip the question ELIGIBLE if it passes. Only `repository` and
 * `enrollmentRepo` are exercised, so the other injected dependencies are
 * stubbed.
 */

const QUESTION_ID = '64b000000000000000000009';
const USER_ID = '64b000000000000000000010';
const COURSE_ID = '64b000000000000000000011';
const COURSE_VERSION_ID = '64b000000000000000000012';

function makeService(overrides: {
  recordCrowdResponse: (...args: any[]) => Promise<any>;
  findByIds?: (...args: any[]) => Promise<any[]>;
  markEligible?: (...args: any[]) => Promise<void>;
  countActiveStudents?: (...args: any[]) => Promise<number>;
}) {
  const markEligible = vi.fn(overrides.markEligible ?? (async () => {}));
  const repository: any = {
    recordCrowdResponse: overrides.recordCrowdResponse,
    findByIds:
      overrides.findByIds ??
      (async () => [
        {courseId: {toString: () => COURSE_ID}, courseVersionId: {toString: () => COURSE_VERSION_ID}},
      ]),
    markEligible,
  };
  const enrollmentRepo: any = {
    countActiveStudents: vi.fn(overrides.countActiveStudents ?? (async () => 40)),
  };

  const service = new StudentQuestionService(
    repository,
    {} as any, // settingRepo
    {} as any, // notificationService
    {} as any, // questionService
    {} as any, // questionBankService
    {} as any, // itemRepo
    {} as any, // screeningService
    {} as any, // segmentContextProvider
    enrollmentRepo,
  );

  return {service, repository, enrollmentRepo, markEligible};
}

describe('StudentQuestionService.recordPeerResponse', () => {
  it('does nothing when the response was already recorded (idempotent)', async () => {
    const {service, markEligible} = makeService({
      recordCrowdResponse: async () => null,
    });

    await service.recordPeerResponse({
      studentQuestionId: QUESTION_ID,
      userId: USER_ID,
      isCorrect: true,
    });

    expect(markEligible).not.toHaveBeenCalled();
  });

  it('marks eligible once the enrollment-scaled gate passes', async () => {
    // 40 enrolled -> threshold 20 (half the cohort). 20 responses, correctRate
    // 0.5, thumbsDownRate 0 -> eligible.
    const {service, markEligible, enrollmentRepo} = makeService({
      recordCrowdResponse: async () => ({
        responseCount: 20,
        correctCount: 10,
        thumbsUpCount: 19,
        thumbsDownCount: 1,
      }),
      countActiveStudents: async () => 40,
    });

    await service.recordPeerResponse({
      studentQuestionId: QUESTION_ID,
      userId: USER_ID,
      isCorrect: true,
      thumb: 'UP',
    });

    expect(enrollmentRepo.countActiveStudents).toHaveBeenCalledWith(
      COURSE_ID,
      COURSE_VERSION_ID,
    );
    expect(markEligible).toHaveBeenCalledWith(QUESTION_ID);
  });

  it('does not mark eligible when the gate has not been reached yet', async () => {
    // 40 enrolled -> threshold 20. Only 5 responses so far.
    const {service, markEligible} = makeService({
      recordCrowdResponse: async () => ({
        responseCount: 5,
        correctCount: 2,
        thumbsUpCount: 5,
        thumbsDownCount: 0,
      }),
      countActiveStudents: async () => 40,
    });

    await service.recordPeerResponse({
      studentQuestionId: QUESTION_ID,
      userId: USER_ID,
      isCorrect: false,
    });

    expect(markEligible).not.toHaveBeenCalled();
  });

  it('does nothing when the question cannot be found', async () => {
    const {service, markEligible} = makeService({
      recordCrowdResponse: async () => ({
        responseCount: 200,
        correctCount: 100,
        thumbsUpCount: 200,
        thumbsDownCount: 0,
      }),
      findByIds: async () => [],
    });

    await service.recordPeerResponse({
      studentQuestionId: QUESTION_ID,
      userId: USER_ID,
      isCorrect: true,
    });

    expect(markEligible).not.toHaveBeenCalled();
  });

  it('swallows errors — never throws into the quiz-submission path', async () => {
    const {service} = makeService({
      recordCrowdResponse: async () => {
        throw new Error('db down');
      },
    });

    await expect(
      service.recordPeerResponse({
        studentQuestionId: QUESTION_ID,
        userId: USER_ID,
        isCorrect: true,
      }),
    ).resolves.toBeUndefined();
  });
});
