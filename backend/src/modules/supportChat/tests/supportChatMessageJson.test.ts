import {describe, it, expect} from 'vitest';
import express from 'express';
import request from 'supertest';
import {ObjectId} from 'mongodb';
import {useContainer, useExpressServer} from 'routing-controllers';
import {
  ChatController,
  toChatMessageJson,
} from '../controllers/ChatController.js';
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

describe('POST /api/support/chat/message', () => {
  it('sends ids the widget can put in a URL', async () => {
    const chatService = {handleUserQuestion: async () => reply};
    const controller = new ChatController(chatService as never);
    useContainer({get: () => controller} as never);

    const app = express();
    app.use(express.json());
    useExpressServer(app, {
      controllers: [ChatController],
      routePrefix: '/api',
      authorizationChecker: async () => true,
      currentUserChecker: async () => ({id: new ObjectId().toHexString()}),
    });

    const res = await request(app)
      .post('/api/support/chat/message')
      .send({question: 'webcam not detected'});

    expect(res.status).toBe(200);
    expect(res.body.questionId).toBe(questionId.toHexString());
    expect(res.body.faqId).toBe(faqId.toHexString());
  });
});
