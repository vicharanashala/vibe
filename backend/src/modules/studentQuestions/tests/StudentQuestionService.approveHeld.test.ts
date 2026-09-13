import {describe, it, expect} from 'vitest';
import {ObjectId} from 'mongodb';
import {StudentQuestionService} from '../services/StudentQuestionService.js';
import {ItemType} from '#root/shared/interfaces/models.js';

/**
 * A HELD question (screening was unsure) never goes through
 * `_stageToSubmittedBank` on submit — only a screening PASS does that — so it
 * has no `promotedQuestionId`. Approving one must stage it on the spot
 * instead of silently no-oping (the bug this test guards against): no quiz
 * Question ever got created, so the question would never reach the graded
 * bank even though its status flipped to APPROVED.
 */

const courseId = '64c000000000000000000010';
const courseVersionId = '64c000000000000000000011';
const segmentId = '64c000000000000000000012'; // segmentId IS the quiz item here
const questionId = '64c000000000000000000014';
const gradedBankId = '64c000000000000000000015';

function makeService(calls: {addQuestion: any[]; promote: any[]}) {
  const heldQuestion: any = {
    _id: new ObjectId(questionId),
    courseId: new ObjectId(courseId),
    courseVersionId: new ObjectId(courseVersionId),
    segmentId: new ObjectId(segmentId),
    questionText: 'What does async/await do in JavaScript?',
    options: [{text: 'Blocks the thread'}, {text: 'Sugar over promises'}],
    correctOptionIndex: 1,
    status: 'HELD',
    createdBy: new ObjectId('64c000000000000000000013'),
    promotedQuestionId: undefined,
  };

  const repository: any = {
    updateStatus: async () => true,
    findById: async () => heldQuestion,
    setPromotedQuestionId: async () => {},
  };
  const questionService: any = {
    create: async () => '64c0000000000000000000ff',
    setReviewStatus: async () => {},
  };
  const questionBankService: any = {
    findOrCreateCrowdSubmittedBank: async () => 'submitted-bank-id',
    addQuestion: async (bankId: string, qId: string) => {
      calls.addQuestion.push({bankId, qId});
    },
    promoteSubmittedQuestionToGraded: async (qId: string) => {
      calls.promote.push(qId);
    },
  };
  const itemRepo: any = {
    readItemById: async () => ({
      _id: segmentId,
      type: ItemType.QUIZ,
      details: {questionBankRefs: [{bankId: gradedBankId}]},
    }),
  };

  return new StudentQuestionService(
    repository,
    {} as any, // settingRepo
    {} as any, // notificationService — best-effort, wrapped in try/catch
    questionService,
    questionBankService,
    itemRepo,
    {} as any, // screeningService
    {} as any, // segmentContextProvider
    {} as any, // enrollmentRepo
  );
}

describe('updateQuestionStatus — approving a HELD question', () => {
  it('stages the question (creates + adds to submitted bank) before promoting to graded', async () => {
    const calls = {addQuestion: [] as any[], promote: [] as any[]};
    const service = makeService(calls);

    await service.updateQuestionStatus({
      courseId,
      courseVersionId,
      segmentId,
      questionId,
      status: 'APPROVED',
      reviewedBy: '64c000000000000000000099',
    });

    expect(calls.addQuestion).toHaveLength(1);
    expect(calls.addQuestion[0]).toEqual({
      bankId: 'submitted-bank-id',
      qId: '64c0000000000000000000ff',
    });
    expect(calls.promote).toEqual(['64c0000000000000000000ff']);
  });
});
