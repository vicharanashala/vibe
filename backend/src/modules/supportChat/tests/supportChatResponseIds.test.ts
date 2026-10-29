import {describe, it, expect, vi} from 'vitest';
import {instanceToPlain} from 'class-transformer';
import {ObjectId} from 'mongodb';
import {AdminController} from '../controllers/AdminController.js';
import {ChatController} from '../controllers/ChatController.js';
import {stringifyObjectIds} from '../classes/transformers/index.js';
import {SupportQuestionStatus} from '../types.js';

/**
 * Pins the ids the client actually receives. routing-controllers runs every
 * controller result through instanceToPlain (its default) and then
 * JSON.stringify; a raw ObjectId came out of that as
 * `{ buffer: { type: 'Buffer', data: [...] } }`, and the Support Queue built
 * /admin/support/questions/[object Object]/respond from it (#1347).
 */
function overTheWire(body: unknown) {
  return JSON.parse(JSON.stringify(instanceToPlain(body)));
}

const HEX_ID = /^[0-9a-f]{24}$/;

const admin = {
  userId: new ObjectId().toString(),
  globalRole: 'admin',
  enrollments: [],
};
const allowAll = {can: () => true};

function storedQuestion() {
  return {
    _id: new ObjectId(),
    userId: new ObjectId(),
    courseId: new ObjectId(),
    question: 'The video freezes halfway through',
    context: {page: '/student/learn', itemId: new ObjectId()},
    status: SupportQuestionStatus.ESCALATED,
    learnersSeenResponse: false,
    createdAt: new Date('2026-09-07T10:00:00Z'),
    updatedAt: new Date('2026-09-07T10:00:00Z'),
  };
}

describe('support chat responses carry string ids', () => {
  it('lists the admin queue with ids the dashboard can put in a URL', async () => {
    const question = storedQuestion();
    const controller = new AdminController({
      getQuestions: vi.fn(async () => [question]),
    } as any);

    const body = overTheWire(
      await controller.getQuestions(
        {} as any,
        {authenticatedUser: admin} as any,
      ),
    );
    const [listed] = body.questions;

    expect(listed._id).toBe(question._id.toString());
    expect(listed.userId).toBe(question.userId.toString());
    expect(listed.courseId).toBe(question.courseId.toString());
    expect(listed.context.itemId).toBe(question.context.itemId.toString());
    expect(listed.createdAt).toBe('2026-09-07T10:00:00.000Z');
  });

  it('returns string ids on the dashboard summary', async () => {
    const question = storedQuestion();
    const controller = new AdminController({
      getDashboardStats: vi.fn(async () => ({totalQuestions: 1})),
      getQuestions: vi.fn(async () => [question]),
    } as any);

    const body = overTheWire(
      await controller.getDashboard(
        {} as any,
        {authenticatedUser: admin} as any,
      ),
    );

    expect(body.recentPending[0]._id).toBe(question._id.toString());
    expect(body.stats).toEqual({totalQuestions: 1});
  });

  it('answers a question and returns the responder as a string id', async () => {
    const question = storedQuestion();
    const responderId = new ObjectId();
    const answered = {
      ...question,
      status: SupportQuestionStatus.ANSWERED,
      adminResponse: {
        respondedBy: responderId,
        response: 'Clear the cache and reload',
        responseAt: new Date('2026-09-07T11:00:00Z'),
      },
    };
    const adminService = {
      getQuestionById: vi.fn(async () => question),
      respondToQuestion: vi.fn(async () => answered),
    };
    const controller = new AdminController(adminService as any);

    const body = overTheWire(
      await controller.respondToQuestion(
        {id: responderId.toString()},
        {questionId: question._id.toString()} as any,
        {response: 'Clear the cache and reload'} as any,
        {ability: allowAll} as any,
      ),
    );

    expect(adminService.respondToQuestion).toHaveBeenCalledWith(
      question._id,
      responderId,
      expect.anything(),
    );
    expect(body._id).toMatch(HEX_ID);
    expect(body.adminResponse.respondedBy).toBe(responderId.toString());
  });

  it('gives the learner widget a questionId it can rate or escalate with', async () => {
    const questionId = new ObjectId();
    const controller = new ChatController({
      handleUserQuestion: vi.fn(async () => ({
        response: 'Your question has been sent to the course team.',
        confidence: 0,
        isFromFAQ: false,
        isEscalated: true,
        questionId,
      })),
    } as any);

    const body = overTheWire(
      await controller.sendMessage(
        {id: new ObjectId().toString()},
        {question: 'The video freezes halfway through'} as any,
        {} as any,
      ),
    );

    expect(body.questionId).toBe(questionId.toString());
    expect(body.isEscalated).toBe(true);
  });

  it('leaves non-id values alone', () => {
    const when = new Date('2026-09-07T10:00:00Z');

    expect(stringifyObjectIds(null)).toBeNull();
    expect(
      stringifyObjectIds({embedding: [0.1, 0.2], createdAt: when, count: 3}),
    ).toEqual({
      embedding: [0.1, 0.2],
      createdAt: when,
      count: 3,
    });
  });
});
