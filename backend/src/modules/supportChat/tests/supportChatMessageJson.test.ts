import {describe, it, expect} from 'vitest';
import {instanceToPlain} from 'class-transformer';
import {ObjectId} from 'mongodb';
import {toChatMessageJson} from '../controllers/ChatController.js';
import {ChatMessageResponse} from '../types.js';

/**
 * routing-controllers serialises replies with class-transformer, which turns
 * an ObjectId into a plain object. The widget then requested
 * `/support/chat/[object Object]/rate`, so "Helpful", "Not helpful" and the
 * issue-report form all failed with 400. These pin string ids on the wire.
 */

const questionId = new ObjectId();
const faqId = new ObjectId();

const reply: ChatMessageResponse = {
  response: 'Allow camera access.',
  confidence: 0,
  faqId,
  isFromFAQ: false,
  isAIGenerated: true,
  isEscalated: false,
  questionId,
};

describe('toChatMessageJson', () => {
  it('turns both ids into hex strings and keeps everything else', () => {
    expect(toChatMessageJson(reply)).toEqual({
      ...reply,
      questionId: questionId.toHexString(),
      faqId: faqId.toHexString(),
    });
  });

  it('leaves faqId unset on an escalated reply', () => {
    const escalated = {...reply, faqId: undefined, isEscalated: true};

    expect(toChatMessageJson(escalated).faqId).toBeUndefined();
  });
});

describe('serialised reply', () => {
  // The same class-transformer call routing-controllers makes on a reply.
  it('keeps ids as strings through instanceToPlain', () => {
    const plain = instanceToPlain(toChatMessageJson(reply));

    expect(plain.questionId).toBe(questionId.toHexString());
    expect(plain.faqId).toBe(faqId.toHexString());
  });
});
