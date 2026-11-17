import {describe, it, expect, vi} from 'vitest';
import {BadRequestError} from 'routing-controllers';
import {ProgressService} from '#users/services/ProgressService.js';

/**
 * Failing a quiz (with attempts left) in a linear course sends the student
 * back to the video before it. That video is already complete, so stopping
 * it used to be a no-op: the student's current item never moved forward and
 * they looped between the video and the quiz. The rewatch is now required,
 * tracked, and moves them back to the quiz; the quiz is refused until then.
 *
 * Collaborators are stubbed the same way as
 * ProgressService.stopItemStaleWatchSession.test.ts.
 */

const USER_ID = 'user-1';
const COURSE_ID = 'course-1';
const VERSION_ID = 'version-1';
const VIDEO_ID = 'video-1';
const QUIZ_ID = 'quiz-1';
const MODULE_ID = 'module-1';
const SECTION_ID = 'section-1';
const WATCH_ID = 'watchtime-1';

function makeService({
  currentItem = VIDEO_ID,
  linear = true,
  courseCompleted = false,
  videoCompleted = true,
  closedSession = {_id: WATCH_ID},
}: {
  currentItem?: string;
  linear?: boolean;
  courseCompleted?: boolean;
  videoCompleted?: boolean;
  closedSession?: unknown;
} = {}) {
  const service: any = Object.create(ProgressService.prototype);
  service.contentLockService = {assertOpenForUser: async () => {}};
  service._withTransaction = async (fn: any) => fn({} as any);
  service.courseRepo = {
    readVersion: async () => ({
      _id: VERSION_ID,
      courseId: COURSE_ID,
      modules: [],
    }),
    getCourseVersionStatus: async () => 'active',
    getItemGroupInfo: async () => ({
      courseVersionId: VERSION_ID,
      moduleId: MODULE_ID,
      sectionId: SECTION_ID,
    }),
  };
  service.itemRepo = {
    readItemById: async (id: string) =>
      id === QUIZ_ID
        ? {_id: QUIZ_ID, type: 'QUIZ', name: 'Quiz 1'}
        : {_id: VIDEO_ID, type: 'VIDEO', name: '1.1 Tutorial'},
    findItemsGroupByItemId: async () => ({
      _id: 'group-1',
      items: [
        {_id: VIDEO_ID, type: 'VIDEO'},
        {_id: QUIZ_ID, type: 'QUIZ'},
      ],
    }),
  };
  service.getCourseSettingService = () => ({
    isLinearProgressionEnabled: async () => linear,
  });
  service.progressRepository = {
    findProgress: async () => ({
      completed: courseCompleted,
      currentModule: MODULE_ID,
      currentSection: SECTION_ID,
      currentItem,
    }),
    isItemCompleted: vi.fn().mockResolvedValue(videoCompleted),
    stopItemTrackingForItem: vi.fn().mockResolvedValue(closedSession),
    updateProgress: vi.fn().mockResolvedValue({completed: false}),
  };
  service.validateWatchTime = vi.fn();
  service.getNextItemInSequence = async () => ({
    moduleId: MODULE_ID,
    sectionId: SECTION_ID,
    itemId: QUIZ_ID,
  });
  service.getPreviousVideoItem = async () => ({
    moduleId: MODULE_ID,
    sectionId: SECTION_ID,
    itemId: VIDEO_ID,
  });
  return service;
}

function stopVideo(service: any) {
  return service.stopItem(
    USER_ID,
    COURSE_ID,
    VERSION_ID,
    VIDEO_ID,
    SECTION_ID,
    MODULE_ID,
    WATCH_ID,
  );
}

describe('ProgressService — rewatch after a failed quiz', () => {
  it('finishing the required rewatch moves the student back to the quiz', async () => {
    const service = makeService();

    await stopVideo(service);

    expect(
      service.progressRepository.stopItemTrackingForItem,
    ).toHaveBeenCalledTimes(1);
    expect(service.validateWatchTime).toHaveBeenCalledTimes(1);
    expect(service.progressRepository.updateProgress).toHaveBeenCalledWith(
      USER_ID,
      COURSE_ID,
      VERSION_ID,
      {
        currentModule: MODULE_ID,
        currentSection: SECTION_ID,
        currentItem: QUIZ_ID,
      },
      undefined,
      expect.anything(),
    );
  });

  it('refuses a rewatch stop with no open watch session', async () => {
    const service = makeService({closedSession: null});

    await expect(stopVideo(service)).rejects.toThrow(BadRequestError);
    expect(service.progressRepository.updateProgress).not.toHaveBeenCalled();
  });

  it('leaves a completed video that is not the current item alone', async () => {
    const service = makeService({currentItem: 'video-2'});

    await stopVideo(service);

    expect(
      service.progressRepository.stopItemTrackingForItem,
    ).not.toHaveBeenCalled();
    expect(service.progressRepository.updateProgress).not.toHaveBeenCalled();
  });

  it('leaves non-linear courses alone', async () => {
    const service = makeService({linear: false});

    await stopVideo(service);

    expect(service.progressRepository.updateProgress).not.toHaveBeenCalled();
  });

  it('refuses the quiz while the rewatch is pending, naming the video', async () => {
    const service = makeService();

    await expect(
      service.assertNoRewatchPending(USER_ID, QUIZ_ID),
    ).rejects.toThrow('Watch "1.1 Tutorial" again before retaking this quiz.');
  });

  it('allows the quiz once the student is back on it', async () => {
    const service = makeService({currentItem: QUIZ_ID});

    await expect(
      service.assertNoRewatchPending(USER_ID, QUIZ_ID),
    ).resolves.toBeUndefined();
  });

  it('leaves the first viewing to the usual order checks', async () => {
    const service = makeService({videoCompleted: false});

    await expect(
      service.assertNoRewatchPending(USER_ID, QUIZ_ID),
    ).resolves.toBeUndefined();
  });

  it('does not gate quizzes in non-linear courses', async () => {
    const service = makeService({linear: false});

    await expect(
      service.assertNoRewatchPending(USER_ID, QUIZ_ID),
    ).resolves.toBeUndefined();
  });
});
