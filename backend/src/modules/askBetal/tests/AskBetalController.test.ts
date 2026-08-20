import 'reflect-metadata';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import request from 'supertest';
import Express from 'express';
import { useContainer, useExpressServer } from 'routing-controllers';
import { Container } from 'inversify';
import { InversifyAdapter } from '#root/inversify-adapter.js';
import { GLOBAL_TYPES } from '#root/types.js';
import { ASK_BETAL_TYPES } from '../types.js';
import { AskBetalService } from '../services/AskBetalService.js';
import { AskBetalController } from '../controllers/AskBetalController.js';
import { FirebaseAuthService } from '#root/modules/auth/services/FirebaseAuthService.js';
import { EnrollmentService } from '#root/modules/users/services/EnrollmentService.js';
import { ObjectId } from 'mongodb';
import { HttpErrorHandler } from '#root/shared/index.js';
import { aiConfig } from '#root/config/ai.js';

// Mock Anthropic
vi.mock('@anthropic-ai/sdk', () => {
  return {
    Anthropic: vi.fn().mockImplementation(() => {
      return {
        messages: {
          create: vi.fn().mockResolvedValue({
            content: [{ type: 'text', text: 'Mocked response' }],
          }),
        },
      };
    }),
  };
});

describe('AskBetalController Integration', () => {
  let app: any;
  let mockEnrollments: any[];

  beforeAll(async () => {
    process.env.LLM_PROVIDER = 'anthropic';
    aiConfig.ANTHROPIC_CRED = 'mock-key';
    aiConfig.ANTHROPIC_MODEL = 'claude-3-5-sonnet-20241022';

    mockEnrollments = [
      {
        courseId: new ObjectId('650000000000000000000001'),
        courseVersionId: new ObjectId('650000000000000000000004'),
        role: 'STUDENT',
      },
    ];

    const mockDb = {
      connect: vi.fn().mockResolvedValue({
        collection: (name: string) => {
          return {
            findOne: vi.fn().mockImplementation(async (query: any) => {
              if (name === 'newCourseVersion') {
                if (query.courseId.toString() === '650000000000000000000001') {
                  return {
                    _id: new ObjectId('650000000000000000000004'),
                    name: 'Web Dev 101',
                    courseId: query.courseId,
                    versionStatus: 'active',
                    modules: [],
                  };
                }
              }
              return null;
            }),
            find: vi.fn().mockImplementation(() => ({
              toArray: vi.fn().mockResolvedValue([]),
            })),
            countDocuments: vi.fn().mockResolvedValue(0),
          };
        },
      }),
    };

    const container = new Container();
    container.bind<AskBetalService>(ASK_BETAL_TYPES.AskBetalService).to(AskBetalService).inSingletonScope();
    container.bind(GLOBAL_TYPES.Database).toConstantValue(mockDb as any);
    container.bind(HttpErrorHandler).toSelf().inSingletonScope();
    container.bind(AskBetalController).toSelf().inSingletonScope();

    const mockAuthService = {
      getCurrentUserFromToken: vi.fn().mockResolvedValue({
        _id: new ObjectId('650000000000000000000002'),
        roles: 'student',
      }),
    };

    const mockEnrollmentService = {
      getAllEnrollments: vi.fn().mockImplementation(async () => mockEnrollments),
    };

    container.bind(FirebaseAuthService).toConstantValue(mockAuthService as any);
    container.bind(EnrollmentService).toConstantValue(mockEnrollmentService as any);

    const inversifyAdapter = new InversifyAdapter(container);
    useContainer(inversifyAdapter);

    const appInstance = Express();

    app = useExpressServer(appInstance, {
      controllers: [AskBetalController],
      authorizationChecker: async () => true,
      defaultErrorHandler: true,
      validation: true,
    });
  });

  it('rejects query if student is not enrolled in the course', async () => {
    mockEnrollments = []; // clear enrollments to trigger CASL check failure

    const res = await request(app)
      .post('/ask-betal/ask')
      .set('Authorization', 'Bearer mock-token')
      .send({
        courseId: '650000000000000000000001',
        question: 'What is HTML?',
      });

    expect(res.status).toBe(403);
    expect(res.body.message).toContain('You do not have permission to access this course');
  });

  it('allows query if student is enrolled in the course', async () => {
    mockEnrollments = [
      {
        courseId: new ObjectId('650000000000000000000001'),
        courseVersionId: new ObjectId('650000000000000000000004'),
        role: 'STUDENT',
      },
    ];

    const res = await request(app)
      .post('/ask-betal/ask')
      .set('Authorization', 'Bearer mock-token')
      .send({
        courseId: '650000000000000000000001',
        question: 'What is HTML?',
      });

    expect(res.status).toBe(200);
    expect(res.body.answer).toBe('Mocked response');
  });

  it('enforces rate limiting when request limit is exceeded', async () => {
    mockEnrollments = [
      {
        courseId: new ObjectId('650000000000000000000001'),
        courseVersionId: new ObjectId('650000000000000000000004'),
        role: 'STUDENT',
      },
    ];

    // Fire 50 requests
    for (let i = 0; i < 50; i++) {
      await request(app)
        .post('/ask-betal/ask')
        .set('Authorization', 'Bearer mock-token')
        .send({
          courseId: '650000000000000000000001',
          question: 'What is HTML?',
        });
    }

    // 51st request should be rate-limited
    const res = await request(app)
      .post('/ask-betal/ask')
      .set('Authorization', 'Bearer mock-token')
      .send({
        courseId: '650000000000000000000001',
        question: 'What is HTML?',
      });

    expect(res.status).toBe(429);
    expect(res.body.error).toContain('Too many queries');
  });
});
