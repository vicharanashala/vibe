import {describe, it, expect, beforeEach, afterEach, vi} from 'vitest';
import {ObjectId} from 'mongodb';
import {
  SupportAnswerGenerator,
  buildSupportAnswerPrompt,
  parseSupportAnswer,
} from '../services/SupportAnswerGenerator.js';
import {FAQCategory, IFAQ} from '../types.js';

/**
 * The AI fallback runs only after FAQ retrieval found no confident match. It
 * must answer strictly from the FAQs it is given, and every way it can fail
 * has to come back as null so the question escalates as it always did.
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
  answer:
    'Log in with your registered email.\n\nLink for the website: https://vibe.vicharanashala.ai/auth',
});

const CAMERA_FAQ = faq({
  question:
    "Is the ViBe consent form compulsory? What if I don't want to grant camera access?",
  answer:
    'Yes. Camera access is required for proctoring; allow it in the browser site settings.',
});

const FAQS = [LOGIN_FAQ, CAMERA_FAQ];

const reply = (body: object) => JSON.stringify(body);

describe('buildSupportAnswerPrompt', () => {
  it('numbers every FAQ and fences the learner question', () => {
    const {system, user} = buildSupportAnswerPrompt(
      '  webcam not detected  ',
      FAQS,
    );

    expect(user).toContain(`[1] Q: ${LOGIN_FAQ.question}`);
    expect(user).toContain(`[2] Q: ${CAMERA_FAQ.question}`);
    expect(user).toContain('<<<\nwebcam not detected\n>>>');
    expect(system).toContain('ONLY');
    expect(system).toContain('"answerable"');
  });
});

describe('parseSupportAnswer', () => {
  it('accepts a grounded answer and returns the cited FAQs in order', () => {
    const result = parseSupportAnswer(
      reply({
        answerable: true,
        answer: 'Allow camera access in site settings.',
        faqs: [2, 1],
      }),
      FAQS,
    );

    expect(result?.answer).toBe('Allow camera access in site settings.');
    expect(result?.faqs).toEqual([CAMERA_FAQ, LOGIN_FAQ]);
  });

  it('reads JSON wrapped in a code fence after a reasoning block', () => {
    const raw =
      '<think>the camera FAQ covers it</think>\n```json\n' +
      reply({answerable: true, answer: 'Allow camera access.', faqs: ['2']}) +
      '\n```';

    expect(parseSupportAnswer(raw, FAQS)?.faqs).toEqual([CAMERA_FAQ]);
  });

  it('keeps a link that the cited FAQ contains, even with trailing punctuation', () => {
    const result = parseSupportAnswer(
      reply({
        answerable: true,
        answer: 'Log in at https://vibe.vicharanashala.ai/auth.',
        faqs: [1],
      }),
      FAQS,
    );

    expect(result).not.toBeNull();
  });

  it.each([
    ['a decline', {answerable: false, answer: '', faqs: []}],
    [
      'an answer with no citation',
      {answerable: true, answer: 'Try again later.', faqs: []},
    ],
    [
      'a citation that does not exist',
      {answerable: true, answer: 'Allow camera.', faqs: [3]},
    ],
    [
      'a non-integer citation',
      {answerable: true, answer: 'Allow camera.', faqs: [1.5]},
    ],
    ['an empty answer', {answerable: true, answer: '   ', faqs: [2]}],
    [
      'an over-long answer',
      {answerable: true, answer: 'x'.repeat(2501), faqs: [2]},
    ],
    [
      'a link no cited FAQ contains',
      {
        answerable: true,
        answer: 'Email help at https://example.com/support',
        faqs: [2],
      },
    ],
    [
      'a link from an FAQ it did not cite',
      {
        answerable: true,
        answer: 'See https://vibe.vicharanashala.ai/auth',
        faqs: [2],
      },
    ],
  ])('rejects %s', (_label, body) => {
    expect(parseSupportAnswer(reply(body), FAQS)).toBeNull();
  });

  it('rejects text that is not JSON', () => {
    expect(parseSupportAnswer('Sure! Just allow the camera.', FAQS)).toBeNull();
  });
});

describe('SupportAnswerGenerator', () => {
  let generator: SupportAnswerGenerator;
  let fetchMock: ReturnType<typeof vi.fn>;

  const okResponse = (content: string) => ({
    ok: true,
    status: 200,
    json: async () => ({choices: [{message: {content}}]}),
  });

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.spyOn(console, 'info').mockImplementation(() => undefined);

    generator = new SupportAnswerGenerator();
    generator.config = {
      enabled: true,
      apiKey: 'test-key',
      url: 'https://llm.example.com/v1/chat/completions',
      model: 'test-model',
      timeoutMs: 1000,
      cooldownMs: 60_000,
      maxContextFaqs: 25,
      maxContextChars: 16_000,
    };
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('is unavailable without a key, a model, or when switched off', () => {
    expect(generator.isAvailable()).toBe(true);

    generator.config = {...generator.config, apiKey: undefined};
    expect(generator.isAvailable()).toBe(false);

    generator.config = {...generator.config, apiKey: 'k', model: undefined};
    expect(generator.isAvailable()).toBe(false);

    generator.config = {...generator.config, model: 'm', enabled: false};
    expect(generator.isAvailable()).toBe(false);
  });

  it('sends one chat-completions request and returns the grounded answer', async () => {
    fetchMock.mockResolvedValue(
      okResponse(
        reply({answerable: true, answer: 'Allow camera access.', faqs: [2]}),
      ),
    );

    const result = await generator.generate('webcam not detected', FAQS);

    expect(result?.answer).toBe('Allow camera access.');
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://llm.example.com/v1/chat/completions');
    expect(init.headers.Authorization).toBe('Bearer test-key');
    const body = JSON.parse(init.body);
    expect(body.model).toBe('test-model');
    expect(body.messages[1].content).toContain('webcam not detected');
  });

  it('does not call the model when there are no FAQs to ground it', async () => {
    expect(await generator.generate('anything', [])).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns null and backs off after a provider error', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({}),
    });

    expect(await generator.generate('webcam not detected', FAQS)).toBeNull();
    expect(generator.isAvailable()).toBe(false);

    // The next turn escalates straight away instead of waiting on the provider.
    expect(await generator.generate('webcam not detected', FAQS)).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('treats a MiniMax error inside HTTP 200 as a failure', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        base_resp: {status_code: 1004, status_msg: 'auth failed'},
      }),
    });

    expect(await generator.generate('webcam not detected', FAQS)).toBeNull();
    expect(generator.isAvailable()).toBe(false);
  });

  it('returns null without backing off when the model declines', async () => {
    fetchMock.mockResolvedValue(
      okResponse(reply({answerable: false, answer: '', faqs: []})),
    );

    expect(
      await generator.generate('what is the hostel fee?', FAQS),
    ).toBeNull();
    expect(generator.isAvailable()).toBe(true);
  });

  it('returns null when the request throws (timeout or network)', async () => {
    fetchMock.mockRejectedValue(
      new Error('The operation was aborted due to timeout'),
    );

    expect(await generator.generate('webcam not detected', FAQS)).toBeNull();
  });
});
