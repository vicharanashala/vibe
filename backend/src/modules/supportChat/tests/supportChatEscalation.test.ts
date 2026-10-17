import { describe, it, expect, vi } from 'vitest';
import { ObjectId } from 'mongodb';
import { ChatService } from '../services/ChatService.js';
import { AdminService } from '../services/AdminService.js';
import { SupportQuestionRepository } from '../repositories/providers/mongodb/SupportQuestionRepository.js';
import { resolveSupportQueueCourseIds } from '../abilities/index.js';
import { FAQCategory, SupportQuestionStatus } from '../types.js';

/**
 * The bot used to report `isEscalated` in the HTTP response only, leaving the
 * stored question PENDING and indistinguishable from one it had answered. The
 * admin queue is built on the stored status, so these pin the write.
 */

function questionRepoStub(overrides: Partial<SupportQuestionRepository> = {}) {
  return {
    create: vi.fn(async (q: any) => ({ ...q, _id: new ObjectId() })),
    updateStatus: vi.fn(async () => null),
    setFaqMatch: vi.fn(async () => null),
    setEscalation: vi.fn(async () => null),
    findForAdmin: vi.fn(async () => []),
    getStats: vi.fn(async () => ({
      total: 0,
      byStatus: {},
      avgResolutionTime: 0,
    })),
    ...overrides,
  } as unknown as SupportQuestionRepository;
}

describe('ChatService escalation', () => {
  it('stores ESCALATED when no FAQ matches', async () => {
    const questionRepo = questionRepoStub();
    const service = new ChatService(
      { retrieveFAQ: vi.fn(async () => null) } as any,
      { incrementUsageCount: vi.fn() } as any,
      questionRepo,
    );

    const result = await service.handleUserQuestion(new ObjectId(), {
      question: 'The video freezes halfway through',
    });

    expect(result.isEscalated).toBe(true);
    expect(questionRepo.updateStatus).toHaveBeenCalledWith(
      result.questionId,
      SupportQuestionStatus.ESCALATED,
    );
  });

  it('leaves an FAQ-answered question alone', async () => {
    const questionRepo = questionRepoStub();
    const faq = { _id: new ObjectId(), answer: 'Reload the page', createdAt: new Date() };
    const service = new ChatService(
      { retrieveFAQ: vi.fn(async () => ({ faq, score: 0.9 })) } as any,
      { incrementUsageCount: vi.fn(async () => undefined) } as any,
      questionRepo,
    );

    const result = await service.handleUserQuestion(new ObjectId(), { question: 'help' });

    expect(result.isEscalated).toBe(false);
    expect(questionRepo.updateStatus).not.toHaveBeenCalled();
  });

  it('attaches the learner issue report to the question', async () => {
    const questionRepo = questionRepoStub();
    const service = new ChatService({} as any, {} as any, questionRepo);
    const questionId = new ObjectId();

    await service.escalateQuestion(questionId, {
      category: FAQCategory.TECHNICAL,
      details: 'Player stops at 3:12 on Chrome',
      contactEmail: 'learner@example.com',
    });

    expect(questionRepo.setEscalation).toHaveBeenCalledWith(
      questionId,
      expect.objectContaining({
        category: FAQCategory.TECHNICAL,
        details: 'Player stops at 3:12 on Chrome',
        contactEmail: 'learner@example.com',
      }),
    );
  });
});

describe('AdminService queue', () => {
  it('defaults to the open queue, escalated included', async () => {
    const questionRepo = questionRepoStub();
    const service = new AdminService({} as any, questionRepo, {} as any);

    await service.getQuestions({ courseIds: undefined });

    expect(questionRepo.findForAdmin).toHaveBeenCalledWith(
      expect.objectContaining({
        statuses: [SupportQuestionStatus.ESCALATED, SupportQuestionStatus.PENDING],
        courseIds: undefined,
      }),
    );
  });

  it('passes an explicit status filter straight through', async () => {
    const questionRepo = questionRepoStub();
    const service = new AdminService({} as any, questionRepo, {} as any);

    await service.getQuestions({ courseIds: [] }, { status: SupportQuestionStatus.RESOLVED });

    expect(questionRepo.findForAdmin).toHaveBeenCalledWith(
      expect.objectContaining({
        statuses: [SupportQuestionStatus.RESOLVED],
        courseIds: [],
      }),
    );
  });
});

describe('support queue scope', () => {
  it('leaves admins unrestricted', () => {
    expect(
      resolveSupportQueueCourseIds({
        userId: 'u1',
        globalRole: 'admin',
        enrollments: [],
      } as any),
    ).toBeUndefined();
  });

  it('restricts an instructor to the courses they staff', () => {
    const courseId = new ObjectId().toString();
    const scope = resolveSupportQueueCourseIds({
      userId: 'u1',
      globalRole: 'user',
      enrollments: [
        { courseId, versionId: 'v1', role: 'INSTRUCTOR', cohortIds: null },
        { courseId: new ObjectId().toString(), versionId: 'v2', role: 'STUDENT', cohortIds: null },
      ],
    } as any);

    expect(scope?.map(id => id.toString())).toEqual([courseId]);
  });

  it('gives a plain learner an empty scope rather than a missing one', () => {
    const scope = resolveSupportQueueCourseIds({
      userId: 'u1',
      globalRole: 'user',
      enrollments: [
        { courseId: new ObjectId().toString(), versionId: 'v1', role: 'STUDENT', cohortIds: null },
      ],
    } as any);

    expect(scope).toEqual([]);
  });
});

describe('SupportQuestionRepository admin filter', () => {
  function repoWithCollection() {
    const cursor = {
      sort: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      toArray: vi.fn(async () => []),
    };
    const collection = { find: vi.fn(() => cursor) };
    const repo = new SupportQuestionRepository({
      getCollection: vi.fn(async () => collection),
    } as any);

    return { repo, collection };
  }

  it('matches nothing when the caller staffs no course', async () => {
    const { repo, collection } = repoWithCollection();

    await repo.findForAdmin({ courseIds: [] });

    expect(collection.find).toHaveBeenCalledWith({ courseId: { $in: [] } });
  });

  it('does not filter by course for an unrestricted caller', async () => {
    const { repo, collection } = repoWithCollection();

    await repo.findForAdmin({ statuses: [SupportQuestionStatus.ESCALATED] });

    expect(collection.find).toHaveBeenCalledWith({
      status: { $in: [SupportQuestionStatus.ESCALATED] },
    });
  });
});
