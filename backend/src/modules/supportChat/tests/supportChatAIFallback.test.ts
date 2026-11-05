import {describe, it, expect, vi} from 'vitest';
import {ObjectId} from 'mongodb';
import {ChatService} from '../services/ChatService.js';
import {FAQRetrievalService} from '../services/FAQRetrievalService.js';
import {SupportQuestionRepository} from '../repositories/providers/mongodb/SupportQuestionRepository.js';
import {FAQCategory, IFAQ, SupportQuestionStatus} from '../types.js';

/**
 * Where the AI fallback sits in a chat turn: only after FAQ retrieval misses,
 * and only a decline (or no generator at all) escalates.
 */

function questionRepoStub() {
  return {
    create: vi.fn(async (q: any) => ({...q, _id: new ObjectId()})),
    updateStatus: vi.fn(async () => null),
    setFaqMatch: vi.fn(async () => null),
    setAIAnswer: vi.fn(async () => null),
  } as unknown as SupportQuestionRepository;
}

const CAMERA_FAQ = {
  _id: new ObjectId(),
  question: 'Do I need to grant camera access?',
  answer: 'Yes, allow camera access in your browser.',
  createdAt: new Date(),
} as IFAQ;

function makeService({
  faqMatch = null as any,
  generated = null as any,
  available = true,
  withGenerator = true,
} = {}) {
  const questionRepo = questionRepoStub();
  const faqRepo = {incrementUsageCount: vi.fn(async () => undefined)};
  const retrieval = {
    retrieveFAQ: vi.fn(async () => faqMatch),
    rankForContext: vi.fn(async () => [CAMERA_FAQ]),
  };
  const generator = {
    isAvailable: vi.fn(() => available),
    generate: vi.fn(async () => generated),
  };

  const service = new ChatService(
    retrieval as any,
    faqRepo as any,
    questionRepo,
    withGenerator ? (generator as any) : undefined,
  );

  return {service, questionRepo, faqRepo, retrieval, generator};
}

describe('ChatService AI fallback', () => {
  it('answers from the model when no FAQ matches, without escalating', async () => {
    const {service, questionRepo, faqRepo, generator} = makeService({
      generated: {
        answer: 'Allow camera access in your browser.',
        faqs: [CAMERA_FAQ],
      },
    });

    const result = await service.handleUserQuestion(new ObjectId(), {
      question: 'webcam not detected',
    });

    expect(generator.generate).toHaveBeenCalledWith('webcam not detected', [
      CAMERA_FAQ,
    ]);
    expect(result).toMatchObject({
      response: 'Allow camera access in your browser.',
      isAIGenerated: true,
      isFromFAQ: false,
      isEscalated: false,
      faqId: CAMERA_FAQ._id,
    });
    expect(result.source).toContain(CAMERA_FAQ.question);
    expect(questionRepo.setAIAnswer).toHaveBeenCalledWith(
      result.questionId,
      CAMERA_FAQ._id,
      'Allow camera access in your browser.',
    );
    expect(faqRepo.incrementUsageCount).toHaveBeenCalledWith(CAMERA_FAQ._id);
    expect(questionRepo.updateStatus).not.toHaveBeenCalled();
  });

  it('escalates when the model declines', async () => {
    const {service, questionRepo} = makeService({generated: null});

    const result = await service.handleUserQuestion(new ObjectId(), {
      question: 'what is the hostel fee?',
    });

    expect(result.isEscalated).toBe(true);
    expect(result.isAIGenerated).toBeUndefined();
    expect(questionRepo.updateStatus).toHaveBeenCalledWith(
      result.questionId,
      SupportQuestionStatus.ESCALATED,
    );
  });

  it('does not call the model when an FAQ matched', async () => {
    const faq = {...CAMERA_FAQ, category: FAQCategory.PROCTORING};
    const {service, generator} = makeService({faqMatch: {faq, score: 0.9}});

    const result = await service.handleUserQuestion(new ObjectId(), {
      question: 'Do I need camera access?',
    });

    expect(result.isFromFAQ).toBe(true);
    expect(generator.generate).not.toHaveBeenCalled();
  });

  it('escalates without ranking FAQs when the generator is unavailable', async () => {
    const {service, retrieval, generator} = makeService({available: false});

    const result = await service.handleUserQuestion(new ObjectId(), {
      question: 'webcam?',
    });

    expect(result.isEscalated).toBe(true);
    expect(retrieval.rankForContext).not.toHaveBeenCalled();
    expect(generator.generate).not.toHaveBeenCalled();
  });

  it('escalates when no generator is wired at all', async () => {
    const {service} = makeService({withGenerator: false});

    const result = await service.handleUserQuestion(new ObjectId(), {
      question: 'webcam?',
    });

    expect(result.isEscalated).toBe(true);
  });

  it('escalates instead of failing the turn when the generator throws', async () => {
    const {service, generator} = makeService();
    generator.generate.mockRejectedValue(new Error('boom'));
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const result = await service.handleUserQuestion(new ObjectId(), {
      question: 'webcam?',
    });

    expect(result.isEscalated).toBe(true);
  });
});

describe('FAQRetrievalService.rankForContext', () => {
  const make = (question: string, answer: string) =>
    ({
      _id: new ObjectId(),
      question,
      answer,
      tags: [],
      usageCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      isActive: true,
    }) as unknown as IFAQ;

  const LOGIN = make('How do I log in to ViBe?', 'Use your registered email.');
  const VIDEO = make(
    'Why are videos stuck or repeating?',
    'Watch in sequence.',
  );
  const LONG = make('What are penalty scores?', 'x'.repeat(500));

  function service(faqs: IFAQ[] | Error) {
    vi.stubEnv('MINIMAX_API_KEY', '');
    const repo = {
      findAll: vi.fn(async () => {
        if (faqs instanceof Error) throw faqs;
        return faqs;
      }),
    };
    return new FAQRetrievalService(repo as never);
  }

  it('puts the closest FAQ first even below the confidence bar', async () => {
    const ranked = await service([LOGIN, VIDEO]).rankForContext(
      'my video loops',
      10,
      10_000,
    );

    expect(ranked[0]).toBe(VIDEO);
    expect(ranked).toHaveLength(2);
  });

  it('respects the FAQ count and character budgets', async () => {
    const svc = service([LOGIN, VIDEO, LONG]);

    expect(await svc.rankForContext('video', 1, 10_000)).toEqual([VIDEO]);

    // LONG does not fit in 200 characters, the two short FAQs do.
    const budgeted = await svc.rankForContext('penalty scores', 10, 200);
    expect(budgeted).not.toContain(LONG);
    expect(budgeted).toHaveLength(2);
  });

  it('returns an empty list instead of throwing when the FAQs cannot be read', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(
      await service(new Error('db down')).rankForContext('video', 10, 10_000),
    ).toEqual([]);
  });
});
