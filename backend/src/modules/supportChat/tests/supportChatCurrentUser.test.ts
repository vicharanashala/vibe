import {describe, it, expect, vi} from 'vitest';
import {ObjectId} from 'mongodb';
import {ChatController} from '../controllers/ChatController.js';
import {currentUserId} from '../controllers/currentUserId.js';

/**
 * `@CurrentUser()` is the raw users document: its id is `_id`, not `id`.
 * Reading `user.id` gave every question a random owner, so the learner's
 * own "Helpful" / "Not helpful" and issue reports were refused with 403.
 */

describe('currentUserId', () => {
  it('reads _id from a users document', () => {
    const _id = new ObjectId();

    expect(currentUserId({_id})).toBe(_id.toHexString());
  });

  it('accepts an already-mapped id', () => {
    expect(currentUserId({id: 'abc'})).toBe('abc');
  });

  it('refuses a user with no id instead of inventing one', () => {
    expect(() => currentUserId({})).toThrow();
  });
});

describe('ChatController ownership', () => {
  function makeController() {
    const stored: any[] = [];
    const chatService = {
      handleUserQuestion: vi.fn(async (userId: ObjectId) => {
        const question = {_id: new ObjectId(), userId};
        stored.push(question);
        return {
          response: 'Allow camera access.',
          confidence: 0,
          isFromFAQ: false,
          isAIGenerated: true,
          isEscalated: false,
          questionId: question._id,
        };
      }),
      getQuestion: vi.fn(
        async (id: ObjectId) => stored.find(q => q._id.equals(id)) ?? null,
      ),
      rateResolution: vi.fn(async () => ({})),
    };
    return {controller: new ChatController(chatService as never), chatService};
  }

  it('stores the question under the signed-in user', async () => {
    const {controller, chatService} = makeController();
    const user = {_id: new ObjectId()};

    await controller.sendMessage(user, {question: 'webcam not detected'}, {});

    const [storedUserId] = chatService.handleUserQuestion.mock.calls[0];
    expect(storedUserId.toHexString()).toBe(user._id.toHexString());
  });

  it('lets a learner rate their own question', async () => {
    const {controller, chatService} = makeController();
    const user = {_id: new ObjectId()};

    const reply = await controller.sendMessage(
      user,
      {question: 'webcam not detected'},
      {},
    );
    await controller.rateQuestion(
      user,
      {questionId: reply.questionId},
      {rating: 'not_helpful'},
    );

    expect(chatService.rateResolution).toHaveBeenCalled();
  });

  it("refuses to rate another learner's question", async () => {
    const {controller} = makeController();

    const reply = await controller.sendMessage(
      {_id: new ObjectId()},
      {question: 'webcam not detected'},
      {},
    );

    await expect(
      controller.rateQuestion(
        {_id: new ObjectId()},
        {questionId: reply.questionId},
        {rating: 'helpful'},
      ),
    ).rejects.toThrow();
  });
});
