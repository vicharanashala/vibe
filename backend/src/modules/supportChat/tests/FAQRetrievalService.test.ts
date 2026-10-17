import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ObjectId } from 'mongodb';
import { FAQRetrievalService } from '../services/FAQRetrievalService.js';
import { FAQCategory, IFAQ } from '../types.js';

/**
 * Retrieval has to answer questions with no embedding provider at all: seeded
 * FAQs are stored without vectors, and MINIMAX_API_KEY may be missing or
 * rejected. These specs pin the lexical path — the one that used to score at
 * most 0.2 against a 0.75 threshold, so the bot escalated every question.
 */

function faq(overrides: Partial<IFAQ>): IFAQ {
  return {
    _id: new ObjectId(),
    question: '',
    answer: '',
    category: FAQCategory.OTHER,
    tags: [],
    upvotes: 0,
    downvotes: 0,
    usageCount: 0,
    createdBy: new ObjectId(),
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    isActive: true,
    ...overrides,
  };
}

const LOGIN_FAQ = faq({
  question: 'How do I log in to ViBe?',
  answer: 'Sign up as a student with the registered mail ID, then accept the course invite.',
  category: FAQCategory.LOGIN,
  tags: ['login', 'authentication', 'signup'],
});

const VIDEO_FAQ = faq({
  question: 'Why are videos stuck or repeating?',
  answer: 'Videos must be watched fully and in sequence, with camera permissions enabled.',
  category: FAQCategory.TECHNICAL,
  tags: ['video', 'playback', 'stuck'],
});

const PROCTORING_FAQ = faq({
  question: 'What proctoring does ViBe use during a lesson?',
  answer: 'Your camera stays on for anomaly detection while a lesson is in progress.',
  category: FAQCategory.PROCTORING,
  tags: ['proctoring', 'camera', 'anomaly'],
});

const FAQS = [LOGIN_FAQ, VIDEO_FAQ, PROCTORING_FAQ];

function makeService(faqs: IFAQ[] | Error) {
  const repo = {
    findAll: vi.fn(async () => {
      if (faqs instanceof Error) throw faqs;
      return faqs;
    }),
    setEmbedding: vi.fn(async () => undefined),
  };

  return {
    repo,
    service: new FAQRetrievalService(repo as never),
  };
}

describe('FAQRetrievalService without an embedding provider', () => {
  beforeEach(() => {
    // No key configured: the service must match lexically instead of throwing.
    vi.stubEnv('MINIMAX_API_KEY', '');
  });

  it('answers a question that restates a seeded FAQ', async () => {
    const { service } = makeService(FAQS);

    const result = await service.retrieveFAQ('How do I log in to ViBe?');

    expect(result?.faq.question).toBe(LOGIN_FAQ.question);
    expect(result?.score).toBeGreaterThanOrEqual(0.75);
    expect(result?.similarity).toBe(0);
  });

  it('answers a paraphrase that shares the FAQ\'s distinctive terms', async () => {
    const { service } = makeService(FAQS);

    const result = await service.retrieveFAQ('my videos keep repeating and get stuck');

    expect(result?.faq.question).toBe(VIDEO_FAQ.question);
  });

  it('matches on tags when the wording differs', async () => {
    const { service } = makeService(FAQS);

    const result = await service.retrieveFAQ('camera anomaly during proctoring');

    expect(result?.faq.question).toBe(PROCTORING_FAQ.question);
  });

  it('escalates a question no FAQ covers', async () => {
    const { service } = makeService(FAQS);

    expect(await service.retrieveFAQ('what is the meaning of life')).toBeNull();
  });

  it('escalates rather than throwing when the FAQ lookup fails', async () => {
    const { service } = makeService(new Error('mongo down'));

    expect(await service.retrieveFAQ('How do I log in to ViBe?')).toBeNull();
  });

  it('returns null when no FAQ is active', async () => {
    const { service } = makeService([]);

    expect(await service.retrieveFAQ('How do I log in to ViBe?')).toBeNull();
  });

  it('does not call the embedding provider when no key is configured', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const { service, repo } = makeService(FAQS);

    await service.retrieveFAQ('How do I log in to ViBe?');

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(repo.setEmbedding).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
