import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AskBetalService } from '../services/AskBetalService.js';
import { ObjectId } from 'mongodb';
import { aiConfig } from '#root/config/ai.js';

let lastMessagesCreateArgs: any = null;
let sdkCallCount = 0;

// Mock Anthropic SDK
vi.mock('@anthropic-ai/sdk', () => {
  return {
    Anthropic: vi.fn().mockImplementation(() => {
      return {
        messages: {
          create: vi.fn().mockImplementation(async (args: any) => {
            lastMessagesCreateArgs = args;
            sdkCallCount++;
            return {
              content: [{ type: 'text', text: 'Mocked learning assistant response?\nOPTIONS: Option One | Option Two' }],
              usage: {
                input_tokens: 1000,
                output_tokens: 200,
              }
            };
          }),
        },
      };
    }),
  };
});

describe('AskBetalService', () => {
  let mockDb: any;
  let service: AskBetalService;
  let cacheStore: any[] = [];
  let ledgerStore: any[] = [];

  beforeEach(() => {
    process.env.LLM_PROVIDER = 'anthropic';
    aiConfig.ANTHROPIC_CRED = 'mock-key';
    aiConfig.ANTHROPIC_MODEL = 'claude-3-5-sonnet-20241022';
    aiConfig.ASK_BETAL_DAILY_TOKEN_CAP = 30000;
    lastMessagesCreateArgs = null;
    sdkCallCount = 0;
    cacheStore = [];
    ledgerStore = [];
    process.env.NODE_ENV = 'test';
  });

  function makeService(opts: {
    hasAttempted?: boolean;
    hasVideo?: boolean;
    hasQuiz?: boolean;
    courseVersionOverride?: any;
  } = {}) {
    const {
      hasAttempted = true,
      hasVideo = true,
      hasQuiz = true,
      courseVersionOverride = null,
    } = opts;

    mockDb = {
      connect: vi.fn().mockResolvedValue({
        collection: (name: string) => {
          return {
            createIndex: vi.fn().mockResolvedValue(true),
            findOne: vi.fn().mockImplementation(async (query: any) => {
              if (name === 'askBetalResponseCache') {
                return cacheStore.find(doc => 
                  doc.videoId.toString() === query.videoId?.toString() &&
                  doc.promptType === query.promptType
                ) || null;
              }
              if (name === 'askBetalUsageLedger') {
                return ledgerStore.find(doc => doc.date === query.date) || null;
              }
              if (name === 'newCourseVersion') {
                if (courseVersionOverride) {
                  return courseVersionOverride;
                }
                return {
                  _id: new ObjectId('650000000000000000000004'),
                  name: 'Intro to Web Development',
                  courseId: query.courseId,
                  versionStatus: 'active',
                  modules: [
                    {
                      moduleId: '650000000000000000000101',
                      sections: [{ itemsGroupId: new ObjectId('650000000000000000000102') }],
                    },
                  ],
                };
              }
              return null;
            }),
            find: vi.fn().mockImplementation((query: any) => {
              return {
                toArray: vi.fn().mockImplementation(async () => {
                  if (name === 'itemsGroup') {
                    const items = [];
                    if (hasVideo) items.push({ type: 'VIDEO', _id: new ObjectId('650000000000000000000110') });
                    if (hasQuiz) items.push({ type: 'QUIZ', _id: new ObjectId('650000000000000000000120') });
                    return [{ _id: new ObjectId('650000000000000000000102'), items }];
                  }
                  if (name === 'videos') {
                    return [
                      {
                        _id: new ObjectId('650000000000000000000110'),
                        name: 'HTML Basics',
                        description: 'Learn the core tags of HTML documents.',
                      },
                    ];
                  }
                  if (name === 'quizzes') {
                    return [
                      {
                        _id: new ObjectId('650000000000000000000120'),
                        details: {
                          questionBankRefs: [{ bankId: new ObjectId('650000000000000000000130') }],
                        },
                      },
                    ];
                  }
                  if (name === 'questionBanks') {
                    return [
                      {
                        _id: new ObjectId('650000000000000000000130'),
                        questions: [new ObjectId('650000000000000000000140')],
                      },
                    ];
                  }
                  if (name === 'questions') {
                    return [
                      {
                        _id: new ObjectId('650000000000000000000140'),
                        type: 'SELECT_ONE_IN_LOT',
                        text: 'What does CSS stand for?',
                        hint: 'Style Sheets.',
                        correctLotItem: {
                          text: 'Cascading Style Sheets',
                          explaination: 'Correct! CSS rules cascade.',
                        },
                        incorrectLotItems: [
                          {
                            text: 'Creative Style Sheets',
                            explaination: 'Incorrect. Creative is wrong.',
                          },
                        ],
                      },
                    ];
                  }
                  return [];
                }),
              };
            }),
            countDocuments: vi.fn().mockImplementation(async (query: any) => {
              if (name === 'quiz_attempts') {
                return hasAttempted ? 1 : 0;
              }
              return 0;
            }),
            insertOne: vi.fn().mockImplementation(async (doc: any) => {
              if (name === 'askBetalResponseCache') {
                cacheStore.push(doc);
              }
              return { acknowledged: true, insertedId: new ObjectId() };
            }),
            updateOne: vi.fn().mockImplementation(async (query: any, update: any) => {
              if (name === 'askBetalUsageLedger') {
                let doc = ledgerStore.find(d => d.date === query.date);
                if (!doc) {
                  doc = { date: query.date, tokensUsed: 0, requestCount: 0 };
                  ledgerStore.push(doc);
                }
                if (update.$inc) {
                  if (update.$inc.tokensUsed !== undefined) {
                    doc.tokensUsed += update.$inc.tokensUsed;
                  }
                  if (update.$inc.requestCount !== undefined) {
                    doc.requestCount += update.$inc.requestCount;
                  }
                }
              }
              return { acknowledged: true, modifiedCount: 1 };
            }),
          };
        },
      }),
    };

    const mockDbProvider = {
      connect: mockDb.connect,
    };

    service = new AskBetalService(mockDbProvider as any);
  }

  it('gathers video context and question context when attempted', async () => {
    makeService({ hasAttempted: true });

    await service.askQuestion('650000000000000000000002', {
      courseId: '650000000000000000000001',
      question: 'How do I style web pages?',
    });

    const userMessageContent = lastMessagesCreateArgs.messages[0].content[0].text;
    expect(userMessageContent).toContain('Correct! CSS rules cascade.');
    expect(userMessageContent).toContain('Incorrect. Creative is wrong.');
    expect(userMessageContent).toContain('HTML Basics');
    expect(userMessageContent).not.toContain('LOCKED');
  });

  it('gates and locks explanations for unattempted questions', async () => {
    makeService({ hasAttempted: false });

    await service.askQuestion('650000000000000000000002', {
      courseId: '650000000000000000000001',
      question: 'What is CSS?',
    });

    const userMessageContent = lastMessagesCreateArgs.messages[0].content[0].text;
    expect(userMessageContent).not.toContain('Correct! CSS rules cascade.');
    expect(userMessageContent).not.toContain('Incorrect. Creative is wrong.');
    expect(userMessageContent).toContain('LOCKED');
    expect(userMessageContent).toContain('What does CSS stand for?');
  });

  it('verifies cross-course isolation (unrelated course questions never appear)', async () => {
    const courseVersionOverride = {
      _id: new ObjectId('650000000000000000000004'),
      name: 'Unrelated Course',
      courseId: new ObjectId('650000000000000000000999'),
      versionStatus: 'active',
      modules: [],
    };

    makeService({ hasAttempted: true, courseVersionOverride });

    await service.askQuestion('650000000000000000000002', {
      courseId: '650000000000000000000999',
      question: 'Hello?',
    });

    const userMessageContent = lastMessagesCreateArgs.messages[0].content[0].text;
    expect(userMessageContent).not.toContain('HTML Basics');
    expect(userMessageContent).not.toContain('What does CSS stand for?');
  });

  describe('Quick Prompt Templates & Response Caching', () => {
    it('appends summarize template instructions to user prompt', async () => {
      makeService({ hasAttempted: true });

      await service.askQuestion('650000000000000000000002', {
        courseId: '650000000000000000000001',
        question: 'Summarize this video',
        promptType: 'summarize',
      });

      const userMessageContent = lastMessagesCreateArgs.messages[0].content[0].text;
      expect(userMessageContent).toContain('Task: Provide a concise, high-level summary of the video lecture in view');
    });

    it('enforces quiz gating lock on unattempted questions even with promptType active', async () => {
      makeService({ hasAttempted: false });

      await service.askQuestion('650000000000000000000002', {
        courseId: '650000000000000000000001',
        question: 'Give me short notes',
        promptType: 'short_notes',
      });

      const userMessageContent = lastMessagesCreateArgs.messages[0].content[0].text;
      expect(userMessageContent).toContain('LOCKED');
      expect(userMessageContent).not.toContain('Correct! CSS rules cascade.');
      expect(userMessageContent).toContain('Task: Generate structured, condensed, study-note-style outlines');
    });

    it('caches eligible quick-prompt requests and returns cached hits', async () => {
      makeService({ hasAttempted: false }); // Gated explanations locked, so no attempted context exists

      const payload = {
        courseId: '650000000000000000000001',
        question: 'Summarize this video',
        promptType: 'summarize' as const,
        currentVideoId: '650000000000000000000110',
      };

      // Call 1: Misses cache, makes LLM call
      const res1 = await service.askQuestion('650000000000000000000002', payload);
      expect(res1.answer).toBe('Mocked learning assistant response?');
      expect(res1.replyOptions).toEqual(['Option One', 'Option Two']);
      expect(sdkCallCount).toBe(1);
      expect(cacheStore.length).toBe(1);
      expect(cacheStore[0].replyOptions).toEqual(['Option One', 'Option Two']);

      // Call 2: Hits cache, skips LLM call
      const res2 = await service.askQuestion('650000000000000000000002', payload);
      expect(res2.answer).toBe('Mocked learning assistant response?');
      expect(res2.replyOptions).toEqual(['Option One', 'Option Two']);
      expect(sdkCallCount).toBe(1); // Call count remains 1!
    });

    it('CRITICAL SECURITY GATE: never caches or serves from cache if context contains attempted-question explanations', async () => {
      makeService({ hasAttempted: true }); // Unlocks correct/incorrect explanations!

      const payload = {
        courseId: '650000000000000000000001',
        question: 'Summarize this video',
        promptType: 'summarize' as const,
        currentVideoId: '650000000000000000000110',
      };

      // Call 1: executes LLM call
      await service.askQuestion('650000000000000000000002', payload);
      expect(sdkCallCount).toBe(1);
      expect(cacheStore.length).toBe(0); // Should NOT write to cache!

      // Call 2: still executes LLM call (doesn't hit cache)
      await service.askQuestion('650000000000000000000002', payload);
      expect(sdkCallCount).toBe(2); // Should trigger a second LLM call!
    });
  });

  describe('Spend Ledger and Daily Cap', () => {
    it('logs token usage atomically in usage ledger on every real LLM call', async () => {
      makeService({ hasAttempted: false });

      const payload = {
        courseId: '650000000000000000000001',
        question: 'Hello',
      };

      await service.askQuestion('650000000000000000000002', payload);
      expect(ledgerStore.length).toBe(1);
      expect(ledgerStore[0].tokensUsed).toBe(1200); // 1000 input + 200 output tokens
      expect(ledgerStore[0].requestCount).toBe(1);
    });

    it('blocks subsequent LLM calls when today spend exceeds the configured daily cap', async () => {
      makeService({ hasAttempted: false });
      aiConfig.ASK_BETAL_DAILY_TOKEN_CAP = 1000; // Low cap

      const payload = {
        courseId: '650000000000000000000001',
        question: 'Hello',
      };

      // First call succeeds and consumes 1200 tokens
      await service.askQuestion('650000000000000000000002', payload);

      // Second call fails because 1200 >= 1000 limit
      await expect(service.askQuestion('650000000000000000000002', payload))
        .rejects.toThrow('Ask Betal is temporarily unavailable due to daily limit restrictions.');
    });
  });

  describe('getUsageStatus', () => {
    it('returns 25 estimated questions on a fresh day with default 30000 token cap', async () => {
      makeService({ hasAttempted: false });
      expect(aiConfig.ASK_BETAL_DAILY_TOKEN_CAP).toBe(30000);
      
      const res = await service.getUsageStatus();
      expect(res.estimatedQuestionsRemaining).toBe(25);
    });

    it('returns full estimated count when no ledger entry exists yet today', async () => {
      makeService({ hasAttempted: false });
      aiConfig.ASK_BETAL_DAILY_TOKEN_CAP = 6000;
      
      const res = await service.getUsageStatus();
      expect(res.estimatedQuestionsRemaining).toBe(5);
    });

    it('returns estimated questions remaining based on ledger state', async () => {
      makeService({ hasAttempted: false });
      aiConfig.ASK_BETAL_DAILY_TOKEN_CAP = 5000;
      
      const todayStr = new Date().toISOString().split('T')[0];
      ledgerStore.push({ date: todayStr, tokensUsed: 1400, requestCount: 1 });
      
      const res = await service.getUsageStatus();
      expect(res.estimatedQuestionsRemaining).toBe(3);
    });

    it('returns 0 when spend exceeds cap', async () => {
      makeService({ hasAttempted: false });
      aiConfig.ASK_BETAL_DAILY_TOKEN_CAP = 1000;
      
      const todayStr = new Date().toISOString().split('T')[0];
      ledgerStore.push({ date: todayStr, tokensUsed: 1200, requestCount: 1 });
      
      const res = await service.getUsageStatus();
      expect(res.estimatedQuestionsRemaining).toBe(0);
    });
  });

  describe('stripThinkingBlocks', () => {
    it('correctly strips <think>...</think> tags and returns the clean text', () => {
      makeService({ hasAttempted: false });
      const rawText = '<think>I should summarize the video concepts.</think>This video covers programming logic.\nOPTIONS: Option 1 | Option 2';
      const clean = (service as any).stripThinkingBlocks(rawText);
      expect(clean).toBe('This video covers programming logic.\nOPTIONS: Option 1 | Option 2');
    });

    it('handles multi-line thinking blocks and case-insensitive tags', () => {
      makeService({ hasAttempted: false });
      const rawText = '<THINK>\nAnalyzing...\nThinking...\n</THINK>Main content here.';
      const clean = (service as any).stripThinkingBlocks(rawText);
      expect(clean).toBe('Main content here.');
    });
  });
});
