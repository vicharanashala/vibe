import {describe, it, expect, vi} from 'vitest';
import {ProgressService} from '#users/services/ProgressService.js';

/**
 * v3 shares handleQuizeProgressAfterSubmission via the same
 * /quizzes/{quizId}/attempt/{attemptId}/submit endpoint old-vibe uses. The
 * exhausted-single-attempt-quiz-advances behavior and the quiz-completion
 * percent recalculation are old-vibe-only fixes, gated behind the
 * isOldVibeClient flag so v3's pre-existing behavior (send back to rewatch,
 * no percent recalculation) is unchanged unless it explicitly opts in too.
 *
 * Collaborators are stubbed the same way as
 * ProgressService.quizFailRewatch.test.ts.
 */

const USER_ID = 'user-1';
const COURSE_ID = 'course-1';
const VERSION_ID = 'version-1';
const VIDEO_ID = 'video-1';
const QUIZ_ID = 'quiz-1';
const NEXT_ITEM_ID = 'item-after-quiz';
const MODULE_ID = 'module-1';
const SECTION_ID = 'section-1';
const WATCH_ID = 'watchtime-1';

function makeService() {
  const service: any = Object.create(ProgressService.prototype);
  service._withTransaction = async (fn: any) => fn({} as any);
  service.progressRepository = {
    findProgress: async () => ({
      completed: false,
      currentModule: MODULE_ID,
      currentSection: SECTION_ID,
      currentItem: QUIZ_ID,
    }),
    updateProgress: vi.fn().mockResolvedValue(undefined),
    getWatchTime: vi.fn().mockResolvedValue([{_id: WATCH_ID, endTime: null}]),
    findWatchTimeById: vi
      .fn()
      .mockResolvedValue({_id: WATCH_ID, itemId: QUIZ_ID}),
    isItemCompleted: vi.fn().mockResolvedValue(false),
    stopItemTracking: vi.fn().mockResolvedValue(undefined),
  };
  service.courseRepo = {
    readVersion: async () => ({
      _id: VERSION_ID,
      courseId: COURSE_ID,
      modules: [],
    }),
  };
  service.getNextItemInSequence = vi.fn().mockResolvedValue({
    moduleId: MODULE_ID,
    sectionId: SECTION_ID,
    itemId: NEXT_ITEM_ID,
  });
  service.getPreviousVideoItem = vi.fn().mockResolvedValue({
    moduleId: MODULE_ID,
    sectionId: SECTION_ID,
    itemId: VIDEO_ID,
  });
  service.updateEnrollmentProgressPercent = vi
    .fn()
    .mockResolvedValue(undefined);
  return service;
}

function submitExhaustedFail(service: any, isOldVibeClient?: boolean) {
  return service.handleQuizeProgressAfterSubmission(
    USER_ID,
    QUIZ_ID,
    COURSE_ID,
    VERSION_ID,
    /* isPassed */ false,
    WATCH_ID,
    undefined,
    MODULE_ID,
    SECTION_ID,
    /* attemptsExhausted */ true,
    isOldVibeClient,
  );
}

describe('ProgressService.handleQuizeProgressAfterSubmission — v3 isolation gate', () => {
  it('v3 (no isOldVibeClient): an exhausted failed attempt still sends the student back to rewatch, unchanged from before', async () => {
    const service = makeService();

    await submitExhaustedFail(service, undefined);

    expect(service.getPreviousVideoItem).toHaveBeenCalledTimes(1);
    expect(service.getNextItemInSequence).not.toHaveBeenCalled();
    expect(service.progressRepository.updateProgress).toHaveBeenCalledWith(
      USER_ID,
      COURSE_ID,
      VERSION_ID,
      expect.objectContaining({currentItem: VIDEO_ID}),
      undefined,
      expect.anything(),
    );
    expect(service.progressRepository.stopItemTracking).not.toHaveBeenCalled();
    expect(service.updateEnrollmentProgressPercent).not.toHaveBeenCalled();
  });

  it('old-vibe (isOldVibeClient: true): an exhausted failed attempt advances past the quiz and recalculates progress percent', async () => {
    const service = makeService();

    await submitExhaustedFail(service, true);

    expect(service.getNextItemInSequence).toHaveBeenCalledTimes(1);
    expect(service.getPreviousVideoItem).not.toHaveBeenCalled();
    expect(service.progressRepository.updateProgress).toHaveBeenCalledWith(
      USER_ID,
      COURSE_ID,
      VERSION_ID,
      expect.objectContaining({currentItem: NEXT_ITEM_ID}),
      undefined,
      expect.anything(),
    );
    expect(service.progressRepository.stopItemTracking).toHaveBeenCalledWith(
      WATCH_ID,
      expect.anything(),
    );
    expect(service.updateEnrollmentProgressPercent).toHaveBeenCalledTimes(1);
  });

  it('a genuine pass still advances for v3 (unaffected by the gate -- that part of shouldAdvance was never conditional), but the percent recalc stays old-vibe-only', async () => {
    const service = makeService();

    await service.handleQuizeProgressAfterSubmission(
      USER_ID,
      QUIZ_ID,
      COURSE_ID,
      VERSION_ID,
      /* isPassed */ true,
      WATCH_ID,
      undefined,
      MODULE_ID,
      SECTION_ID,
      /* attemptsExhausted */ false,
      /* isOldVibeClient */ undefined,
    );

    expect(service.getNextItemInSequence).toHaveBeenCalledTimes(1);
    expect(service.progressRepository.stopItemTracking).toHaveBeenCalledWith(
      WATCH_ID,
      expect.anything(),
    );
    // Reverts to v3's pre-session behavior: the percent-recalc fix from
    // 79b5da976 is old-vibe-only now, so a plain v3 pass no longer gets it
    // either -- it's a deliberate, separate decision for v3 to opt into.
    expect(service.updateEnrollmentProgressPercent).not.toHaveBeenCalled();
  });

  it('a genuine pass for old-vibe (isOldVibeClient: true) also gets the percent recalc', async () => {
    const service = makeService();

    await service.handleQuizeProgressAfterSubmission(
      USER_ID,
      QUIZ_ID,
      COURSE_ID,
      VERSION_ID,
      /* isPassed */ true,
      WATCH_ID,
      undefined,
      MODULE_ID,
      SECTION_ID,
      /* attemptsExhausted */ false,
      /* isOldVibeClient */ true,
    );

    expect(service.updateEnrollmentProgressPercent).toHaveBeenCalledTimes(1);
  });
});
