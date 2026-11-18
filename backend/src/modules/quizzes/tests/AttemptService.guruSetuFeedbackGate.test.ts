import { describe, it, expect, vi } from 'vitest';
import { ObjectId } from 'mongodb';
import { ForbiddenError } from 'routing-controllers';
import { AttemptService } from '#quizzes/services/AttemptService.js';

/**
 * Regression test for submitFeedBackForm's "previous video must be watched"
 * gate on Guru Setu style feedback-only pilot courses.
 *
 * Those courses' own progress formula deliberately never requires a video to
 * be marked watched (completion = feedback forms submitted only), but this
 * gate used to apply unconditionally -- blocking feedback submission for
 * every such student whose watch-time record happened to be missing,
 * regardless of why. See isGuruSetuProgressCourse / GURU_SETU_PROGRESS_COURSES.
 */

const GURU_SETU_COURSE_ID = '6981df886e100cfe04f9c4ad';
const GURU_SETU_VERSION_ID = '6981df886e100cfe04f9c4ae';

function makeService() {
  const service: any = Object.create(AttemptService.prototype);

  const videoItemId = new ObjectId();
  const feedbackItemId = new ObjectId();
  const items = [
    { _id: videoItemId, type: 'VIDEO' },
    { _id: feedbackItemId, type: 'FEEDBACK' },
  ];

  service.courseRepo = {
    getCourseVersionStatus: vi.fn().mockResolvedValue('active'),
  };
  service.itemRepo = {
    findItemsGroupByItemId: vi.fn().mockResolvedValue({ items }),
  };
  // The video was NOT watched -- this is the exact condition that used to
  // throw unconditionally for every course.
  service.progressRepository = {
    isItemCompleted: vi.fn().mockResolvedValue(false),
  };
  service.feedbackRepository = {
    getFormById: vi.fn().mockResolvedValue({ _id: feedbackItemId }),
    findByUserAndPreviousItem: vi.fn().mockResolvedValue(null),
    createFeedback: vi.fn().mockResolvedValue(undefined),
  };
  // Bypass real Mongo transactions -- this test is about the gate's branch
  // logic, not transactional integrity.
  service._withTransaction = vi.fn(async (op: any) => op({}));

  return { service, feedbackItemId: feedbackItemId.toString() };
}

describe('AttemptService.submitFeedBackForm (Guru Setu video-watch gate)', () => {
  it('skips the video-watch gate for a Guru Setu feedback-only pilot course', async () => {
    const { service, feedbackItemId } = makeService();

    const result = await service.submitFeedBackForm(
      new ObjectId().toString(),
      GURU_SETU_COURSE_ID,
      GURU_SETU_VERSION_ID,
      feedbackItemId,
      { rating: 5 },
    );

    expect(result).toContain('successfully');
    expect(service.feedbackRepository.createFeedback).toHaveBeenCalledTimes(1);
  });

  it('still enforces the video-watch gate for a normal (non-pilot) course', async () => {
    const { service, feedbackItemId } = makeService();

    await expect(
      service.submitFeedBackForm(
        new ObjectId().toString(),
        new ObjectId().toString(),
        new ObjectId().toString(),
        feedbackItemId,
        { rating: 5 },
      ),
    ).rejects.toThrow(ForbiddenError);

    expect(service.feedbackRepository.createFeedback).not.toHaveBeenCalled();
  });
});
