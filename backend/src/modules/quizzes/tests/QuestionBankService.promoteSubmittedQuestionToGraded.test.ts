import {describe, it, expect, vi} from 'vitest';
import {ObjectId} from 'mongodb';
import {QuestionBankService} from '../services/QuestionBankService.js';

/**
 * C1 regression test (see studentQuestions/CROWD_QUESTION_BANK_BUGS.md).
 *
 * Approving a crowd question must MOVE it from the "Submitted – Pending
 * Validation" bank into the graded bank. The bug was that the promote path
 * called `removeQuestion`, whose only effective action is soft-deleting the
 * underlying Question document — so the just-approved question vanished from
 * graded draws (getById filters out soft-deleted questions).
 *
 * The fix detaches only the *reference* from the submitted bank
 * (`removeQuestionRefFromBank`) and never soft-deletes the question.
 */

const SUBMITTED_BANK_ID = '64c0000000000000000000a1';
const GRADED_BANK_ID = '64c0000000000000000000b2';
const QUESTION_ID = '64c0000000000000000000c3';

function submittedBank() {
  return {
    _id: new ObjectId(SUBMITTED_BANK_ID),
    crowdSubmitted: true,
    sourceGradedBankId: new ObjectId(GRADED_BANK_ID),
    questions: [QUESTION_ID],
  };
}

function gradedBank() {
  return {_id: new ObjectId(GRADED_BANK_ID), questions: [QUESTION_ID]};
}

function makeService(banks: any[]) {
  const questionBankRepository: any = {
    getQuestionBanksByQuestionId: vi.fn().mockResolvedValue(banks),
    removeQuestionRefFromBank: vi.fn().mockResolvedValue(true),
  };
  const questionRepository: any = {delete: vi.fn().mockResolvedValue(true)};
  const service: any = new (QuestionBankService as any)(
    questionBankRepository,
    questionRepository,
    {} as any, // courseRepository — unused on this path
    {} as any, // database — BaseService only stores it
  );
  // Spy on the bank-mutation helpers so the test never touches _withTransaction/DB.
  service.addQuestion = vi.fn().mockResolvedValue(null);
  service.removeQuestion = vi.fn().mockResolvedValue(null);
  return {service, questionBankRepository, questionRepository};
}

describe('QuestionBankService.promoteSubmittedQuestionToGraded (C1 regression)', () => {
  it('moves the question to the graded bank WITHOUT soft-deleting it', async () => {
    const {service, questionBankRepository, questionRepository} = makeService([
      submittedBank(),
    ]);

    const result = await service.promoteSubmittedQuestionToGraded(QUESTION_ID);

    expect(result).toBe(GRADED_BANK_ID);
    // Added to the graded bank...
    expect(service.addQuestion).toHaveBeenCalledWith(GRADED_BANK_ID, QUESTION_ID);
    // ...and only the *reference* detached from the submitted bank.
    expect(
      questionBankRepository.removeQuestionRefFromBank,
    ).toHaveBeenCalledWith(SUBMITTED_BANK_ID, QUESTION_ID);
    // The question must NOT be soft-deleted — this is the C1 data-loss bug.
    expect(service.removeQuestion).not.toHaveBeenCalled();
    expect(questionRepository.delete).not.toHaveBeenCalled();
  });

  it('is idempotent: skips re-adding when already in the graded bank', async () => {
    const {service, questionBankRepository} = makeService([
      submittedBank(),
      gradedBank(),
    ]);

    const result = await service.promoteSubmittedQuestionToGraded(QUESTION_ID);

    expect(result).toBe(GRADED_BANK_ID);
    expect(service.addQuestion).not.toHaveBeenCalled();
    expect(
      questionBankRepository.removeQuestionRefFromBank,
    ).toHaveBeenCalledWith(SUBMITTED_BANK_ID, QUESTION_ID);
  });

  it('returns null when the question is in no crowd-submitted bank', async () => {
    const {service, questionBankRepository} = makeService([gradedBank()]);

    const result = await service.promoteSubmittedQuestionToGraded(QUESTION_ID);

    expect(result).toBeNull();
    expect(service.addQuestion).not.toHaveBeenCalled();
    expect(
      questionBankRepository.removeQuestionRefFromBank,
    ).not.toHaveBeenCalled();
  });
});
