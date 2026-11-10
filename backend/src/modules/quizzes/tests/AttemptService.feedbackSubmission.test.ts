import {describe, it, expect, vi} from 'vitest';
import {BadRequestError, ForbiddenError} from 'routing-controllers';
import {ObjectId} from 'mongodb';
import {AttemptService} from '#quizzes/services/AttemptService.js';

/**
 * Feedback submission rules: a new answer replaces the student's earlier ones,
 * the cohort comes from the student's enrollment, a form first in its section
 * is a general form, and a form after a video waits for the video.
 */

const USER = new ObjectId().toString();
const COURSE = new ObjectId().toString();
const VERSION = new ObjectId().toString();
const VIDEO = new ObjectId().toString();
const FORM = new ObjectId().toString();
const COHORT = new ObjectId().toString();

function makeService({
  items = [
    {_id: VIDEO, type: 'VIDEO', order: 'a'},
    {_id: FORM, type: 'FEEDBACK', order: 'b'},
  ] as any[],
  videoDone = true,
  enrollmentCohort = undefined as string | undefined,
} = {}) {
  const service: any = Object.create(AttemptService.prototype);
  const calls: string[] = [];
  service.contentLockService = {assertOpenForUser: async () => {}};
  service._withTransaction = async (fn: any) => fn({});
  service.courseRepo = {getCourseVersionStatus: async () => 'active'};
  service.itemRepo = {findItemsGroupByItemId: async () => ({items})};
  service.progressRepository = {isItemCompleted: vi.fn(async () => videoDone)};
  service.enrollmentRepo = {
    findEnrollment: vi.fn(
      async (_u: string, _c: string, _v: string, cohort?: string) => {
        if (!enrollmentCohort) return {};
        if (cohort && cohort !== enrollmentCohort) return null;
        return {cohortId: new ObjectId(enrollmentCohort)};
      },
    ),
  };
  service.feedbackRepository = {
    getFormById: async () => ({_id: FORM}),
    markReplaced: vi.fn(async () => {
      calls.push('markReplaced');
      return 1;
    }),
    createFeedback: vi.fn(async (doc: any) => {
      calls.push('create');
      return doc;
    }),
    findCurrentForUser: vi.fn(async () => ({
      details: {Q: 'A'},
      createdAt: new Date('2026-11-01'),
    })),
  };
  return {service, calls};
}

const submit = (service: any, cohort?: string) =>
  service.submitFeedBackForm(USER, COURSE, VERSION, FORM, {Q: 'A'}, cohort);

describe('AttemptService.submitFeedBackForm', () => {
  it('replaces the earlier answer, then stores the new one as current', async () => {
    const {service, calls} = makeService();
    await submit(service);
    expect(calls).toEqual(['markReplaced', 'create']);
    const stored = service.feedbackRepository.createFeedback.mock.calls[0][0];
    expect(stored).toMatchObject({isCurrent: true, previousItemType: 'VIDEO'});
    expect(stored.previousItemId.toString()).toBe(VIDEO);
  });

  it('records the cohort from the enrollment when the client sends none', async () => {
    const {service} = makeService({enrollmentCohort: COHORT});
    await submit(service);
    expect(
      service.feedbackRepository.createFeedback.mock.calls[0][0].cohortId.toString(),
    ).toBe(COHORT);
  });

  it('ignores a client cohort the student is not enrolled through', async () => {
    const {service} = makeService({enrollmentCohort: COHORT});
    await submit(service, new ObjectId().toString());
    expect(
      service.feedbackRepository.createFeedback.mock.calls[0][0].cohortId.toString(),
    ).toBe(COHORT);
  });

  it('accepts a form that is first in its section as a general form', async () => {
    const {service} = makeService({
      items: [{_id: FORM, type: 'FEEDBACK', order: 'a'}],
    });
    await submit(service);
    expect(
      service.feedbackRepository.createFeedback.mock.calls[0][0],
    ).toMatchObject({
      previousItemId: null,
      previousItemType: null,
    });
  });

  it('uses section order and skips hidden items to find the lesson before', async () => {
    const quiz = new ObjectId().toString();
    const {service} = makeService({
      items: [
        {_id: FORM, type: 'FEEDBACK', order: 'c'},
        {_id: VIDEO, type: 'VIDEO', order: 'b', isHidden: true},
        {_id: quiz, type: 'QUIZ', order: 'a'},
      ],
    });
    await submit(service);
    const stored = service.feedbackRepository.createFeedback.mock.calls[0][0];
    expect(stored.previousItemId.toString()).toBe(quiz);
    expect(service.progressRepository.isItemCompleted).not.toHaveBeenCalled();
  });

  it('refuses until the previous video is finished', async () => {
    const {service} = makeService({videoDone: false});
    await expect(submit(service)).rejects.toThrow(ForbiddenError);
    await expect(submit(service)).rejects.toThrow(
      'Watch the previous video before sending this feedback.',
    );
    expect(service.feedbackRepository.createFeedback).not.toHaveBeenCalled();
  });

  it('still refuses feedback on a feedback form', async () => {
    const other = new ObjectId().toString();
    const {service} = makeService({
      items: [
        {_id: other, type: 'FEEDBACK', order: 'a'},
        {_id: FORM, type: 'FEEDBACK', order: 'b'},
      ],
    });
    await expect(submit(service)).rejects.toThrow(BadRequestError);
  });
});

describe('AttemptService.getMyFeedback', () => {
  it('returns the student’s current answer', async () => {
    const {service} = makeService();
    expect(await service.getMyFeedback(USER, FORM)).toEqual({
      details: {Q: 'A'},
      createdAt: new Date('2026-11-01'),
    });
    expect(service.feedbackRepository.findCurrentForUser).toHaveBeenCalledWith(
      USER,
      FORM,
    );
  });

  it('returns null when they have not answered', async () => {
    const {service} = makeService();
    service.feedbackRepository.findCurrentForUser = async () => null;
    expect(await service.getMyFeedback(USER, FORM)).toBeNull();
  });
});
