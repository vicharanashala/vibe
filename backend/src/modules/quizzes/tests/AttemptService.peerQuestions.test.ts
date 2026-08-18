import {describe, it, expect, vi} from 'vitest';
import {ObjectId} from 'mongodb';
import {AttemptService} from '../services/AttemptService.js';

/**
 * Unit tests for the Stage-2 crowd-question serving/capture helpers on
 * AttemptService: `_pickCollectingQuestion` (author/already-answered
 * exclusion) and `_capturePeerResponses` (correctness derivation against the
 * shuffled `peerCorrectLotItemId`). Only `studentQuestionRepo` /
 * `studentQuestionService` are exercised, so the other injected dependencies
 * are stubbed.
 */

const USER_ID = '64b000000000000000000020';
const SEGMENT_ID = '64b000000000000000000021';

function question(id: string, extra: Record<string, unknown> = {}) {
  return {
    _id: new ObjectId(id),
    questionText: 'What is 2 + 2?',
    options: [{text: 'Three'}, {text: 'Four'}],
    correctOptionIndex: 1,
    ...extra,
  };
}

function makeService(overrides: {
  findCollectingForSegments?: (...args: any[]) => Promise<any[]>;
  listAnsweredQuestionIds?: (...args: any[]) => Promise<string[]>;
  recordPeerResponse?: (...args: any[]) => Promise<void>;
}) {
  const recordPeerResponse = vi.fn(overrides.recordPeerResponse ?? (async () => {}));
  const studentQuestionRepo: any = {
    findCollectingForSegments: overrides.findCollectingForSegments ?? (async () => []),
    listAnsweredQuestionIds: overrides.listAnsweredQuestionIds ?? (async () => []),
  };
  const studentQuestionService: any = {recordPeerResponse};

  const service = new AttemptService(
    {} as any, // quizRepository
    {} as any, // questionRepository
    {} as any, // attemptRepository
    {} as any, // submissionRepository
    {} as any, // userQuizMetricsRepository
    {} as any, // questionService
    {} as any, // questionBankService
    {} as any, // progressService
    {} as any, // feedbackRepository
    {} as any, // itemRepo
    {} as any, // progressRepository
    {} as any, // courseRepo
    studentQuestionRepo,
    studentQuestionService,
    {} as any, // database
  );

  return {service, studentQuestionRepo, recordPeerResponse};
}

describe('AttemptService._pickCollectingQuestion', () => {
  it('returns null when there are no COLLECTING candidates', async () => {
    const {service} = makeService({findCollectingForSegments: async () => []});
    const result = await (service as any)._pickCollectingQuestion(
      [SEGMENT_ID],
      USER_ID,
    );
    expect(result).toBeNull();
  });

  it('returns the fewest-responses candidate the user has not already answered', async () => {
    const q1 = question('64b000000000000000000001');
    const q2 = question('64b000000000000000000002');
    const {service} = makeService({
      // Repository already sorts fewest-responses-first and excludes the author.
      findCollectingForSegments: async () => [q1, q2],
      listAnsweredQuestionIds: async (_userId: string, ids: string[]) =>
        [ids[0]], // already answered q1
    });

    const result = await (service as any)._pickCollectingQuestion(
      [SEGMENT_ID],
      USER_ID,
    );
    expect(result?._id.toString()).toBe(q2._id.toString());
  });

  it('returns null when every candidate has already been answered', async () => {
    const q1 = question('64b000000000000000000001');
    const {service} = makeService({
      findCollectingForSegments: async () => [q1],
      listAnsweredQuestionIds: async (_userId: string, ids: string[]) => ids,
    });

    const result = await (service as any)._pickCollectingQuestion(
      [SEGMENT_ID],
      USER_ID,
    );
    expect(result).toBeNull();
  });
});

describe('AttemptService._adaptStudentQuestionToRenderView', () => {
  it('returns a correctLotItemId that matches the correct option after shuffling', () => {
    const {service} = makeService({});
    const sq = question('64b000000000000000000003');

    const {renderView, correctLotItemId} = (
      service as any
    )._adaptStudentQuestionToRenderView(sq);

    const matching = (renderView as any).lotItems.find(
      (item: any) => item._id.toString() === correctLotItemId.toString(),
    );
    expect(matching?.text).toBe('Four');
    expect((renderView as any).lotItems).toHaveLength(2);
    expect((renderView as any).isPeerContributed).toBe(true);
  });
});

describe('AttemptService._capturePeerResponses', () => {
  it('records a correct response when the selected lot item matches peerCorrectLotItemId', async () => {
    const {service, recordPeerResponse} = makeService({});
    const correctLotItemId = new ObjectId();
    const attempt: any = {
      questionDetails: [
        {
          questionId: new ObjectId('64b000000000000000000004'),
          source: 'STUDENT_GENERATED',
          peerCorrectLotItemId: correctLotItemId,
        },
      ],
    };
    const answers: any = [
      {
        questionId: '64b000000000000000000004',
        questionType: 'SELECT_ONE_IN_LOT',
        answer: {lotItemId: correctLotItemId.toString()},
        thumb: 'UP',
      },
    ];

    await (service as any)._capturePeerResponses(attempt, answers, USER_ID);

    expect(recordPeerResponse).toHaveBeenCalledWith({
      studentQuestionId: '64b000000000000000000004',
      userId: USER_ID,
      isCorrect: true,
      thumb: 'UP',
    });
  });

  it('records an incorrect response when the selected lot item does not match', async () => {
    const {service, recordPeerResponse} = makeService({});
    const attempt: any = {
      questionDetails: [
        {
          questionId: new ObjectId('64b000000000000000000005'),
          source: 'STUDENT_GENERATED',
          peerCorrectLotItemId: new ObjectId(),
        },
      ],
    };
    const answers: any = [
      {
        questionId: '64b000000000000000000005',
        questionType: 'SELECT_ONE_IN_LOT',
        answer: {lotItemId: new ObjectId().toString()},
      },
    ];

    await (service as any)._capturePeerResponses(attempt, answers, USER_ID);

    expect(recordPeerResponse).toHaveBeenCalledWith(
      expect.objectContaining({isCorrect: false}),
    );
  });

  it('skips capture when the student left the peer question unanswered', async () => {
    const {service, recordPeerResponse} = makeService({});
    const attempt: any = {
      questionDetails: [
        {
          questionId: new ObjectId('64b000000000000000000006'),
          source: 'STUDENT_GENERATED',
          peerCorrectLotItemId: new ObjectId(),
        },
      ],
    };

    await (service as any)._capturePeerResponses(attempt, [], USER_ID);

    expect(recordPeerResponse).not.toHaveBeenCalled();
  });

  it('ignores graded (non-peer) question details entirely', async () => {
    const {service, recordPeerResponse} = makeService({});
    const attempt: any = {
      questionDetails: [
        {questionId: new ObjectId('64b000000000000000000007')}, // no source -> graded
      ],
    };
    const answers: any = [
      {
        questionId: '64b000000000000000000007',
        questionType: 'SELECT_ONE_IN_LOT',
        answer: {lotItemId: new ObjectId().toString()},
      },
    ];

    await (service as any)._capturePeerResponses(attempt, answers, USER_ID);

    expect(recordPeerResponse).not.toHaveBeenCalled();
  });
});
