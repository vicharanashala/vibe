import {describe, it, expect} from 'vitest';
import {StudentQuestionService} from '../services/StudentQuestionService.js';
import {ItemType} from '#root/shared/interfaces/models.js';

/**
 * Unit tests for the private `_resolveTargetQuiz` helper, which underpins
 * crowd-question auto-promotion. Student questions are stored against the
 * VIDEO item's id (`segmentId`); the question must promote into the quiz that
 * sits immediately after that video in the same section's ordered item list.
 *
 * Only `itemRepo` is exercised, so the other injected dependencies are stubbed.
 */

const VIDEO_ID = '64b000000000000000000001';
const QUIZ_ID = '64b000000000000000000002';
const SECOND_VIDEO_ID = '64b000000000000000000003';

function makeService(itemRepo: any): StudentQuestionService {
  // Cast through any: the helper under test only touches itemRepo.
  return new StudentQuestionService(
    {} as any, // repository
    {} as any, // settingRepo
    {} as any, // notificationService
    {} as any, // questionService
    {} as any, // questionBankService
    itemRepo,
  );
}

function quizItem(id: string) {
  return {
    _id: id,
    type: ItemType.QUIZ,
    details: {questionBankRefs: [{bankId: 'bank-1'}]},
  };
}

function videoItem(id: string) {
  return {_id: id, type: ItemType.VIDEO};
}

function call(service: StudentQuestionService, segmentId: string) {
  return (service as any)._resolveTargetQuiz(segmentId) as Promise<unknown>;
}

describe('StudentQuestionService._resolveTargetQuiz', () => {
  it('resolves the quiz immediately after the video segment', async () => {
    const itemRepo = {
      readItemById: async (id: string) =>
        id === VIDEO_ID ? videoItem(VIDEO_ID) : quizItem(QUIZ_ID),
      findItemsGroupByItemId: async () => ({
        items: [
          {_id: QUIZ_ID, type: ItemType.QUIZ, order: 'b'},
          {_id: VIDEO_ID, type: ItemType.VIDEO, order: 'a'},
        ],
      }),
    };

    const result: any = await call(makeService(itemRepo), VIDEO_ID);
    expect(result?._id).toBe(QUIZ_ID);
    expect(result?.details?.questionBankRefs?.[0]?.bankId).toBe('bank-1');
  });

  it('returns the item directly when segmentId is already a quiz', async () => {
    const itemRepo = {
      readItemById: async () => quizItem(QUIZ_ID),
      findItemsGroupByItemId: async () => {
        throw new Error('should not be called for a quiz segment');
      },
    };

    const result: any = await call(makeService(itemRepo), QUIZ_ID);
    expect(result?._id).toBe(QUIZ_ID);
  });

  it('returns null when the video is the last item in the section', async () => {
    const itemRepo = {
      readItemById: async () => videoItem(VIDEO_ID),
      findItemsGroupByItemId: async () => ({
        items: [{_id: VIDEO_ID, type: ItemType.VIDEO, order: 'a'}],
      }),
    };

    expect(await call(makeService(itemRepo), VIDEO_ID)).toBeNull();
  });

  it('returns null when the next item is not a quiz', async () => {
    const itemRepo = {
      readItemById: async () => videoItem(VIDEO_ID),
      findItemsGroupByItemId: async () => ({
        items: [
          {_id: VIDEO_ID, type: ItemType.VIDEO, order: 'a'},
          {_id: SECOND_VIDEO_ID, type: ItemType.VIDEO, order: 'b'},
        ],
      }),
    };

    expect(await call(makeService(itemRepo), VIDEO_ID)).toBeNull();
  });

  it('returns null when no items group contains the segment', async () => {
    const itemRepo = {
      readItemById: async () => videoItem(VIDEO_ID),
      findItemsGroupByItemId: async () => null,
    };

    expect(await call(makeService(itemRepo), VIDEO_ID)).toBeNull();
  });
});
