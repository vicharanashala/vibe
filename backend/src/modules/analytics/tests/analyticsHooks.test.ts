import {describe, it, expect, vi, afterEach} from 'vitest';
import {notifyLearnerChanged, setAnalyticsSinkForTests} from '../events.js';
import {AttemptService} from '#root/modules/quizzes/services/AttemptService.js';
import {ProgressService} from '#root/modules/users/services/ProgressService.js';
import {EnrollmentService} from '#root/modules/users/services/EnrollmentService.js';
import {StudyProgressService} from '#root/modules/users/services/StudyProgressService.js';
import {UserActivityEventService} from '#root/modules/users/services/UserActivityEventService.js';
import {AnomalyService} from '#root/modules/anomalies/services/AnomalyService.js';

/**
 * Task 4.1: each learning write path notifies analytics after its write, with
 * the right version and user, and a failing analytics update can never change
 * or fail the student's request. Services are built with their collaborators
 * stubbed, so only the hook wiring is exercised; the paths' own logic is
 * covered by their existing suites.
 */

const V = 'version-1';
const U = 'user-1';
const C = 'course-1';

function make<T>(cls: abstract new (...args: any[]) => T, stubs: object): T {
  return Object.assign(Object.create(cls.prototype), stubs) as T;
}
const tx = (value: unknown) => ({
  _withTransaction: async () => value,
});

/** Runs `call` with a recording sink and with a sink that throws. */
async function check(call: () => Promise<unknown>, expected = [[V, U]]) {
  const calls: string[][] = [];
  setAnalyticsSinkForTests(async (v, u) => {
    calls.push([v, u]);
  });
  const result = await call();
  expect(calls).toEqual(expected);

  setAnalyticsSinkForTests(() => {
    throw new Error('analytics down');
  });
  expect(await call()).toEqual(result);
  setAnalyticsSinkForTests(() => Promise.reject(new Error('analytics down')));
  expect(await call()).toEqual(result);
  return result;
}

afterEach(() => setAnalyticsSinkForTests(undefined));

describe('notifyLearnerChanged', () => {
  it('returns at once, swallows sync and async failures, and ignores missing ids', async () => {
    let resolve!: () => void;
    const sink = vi.fn(() => new Promise<void>(r => (resolve = r)));
    setAnalyticsSinkForTests(sink);
    expect(notifyLearnerChanged(V, U)).toBeUndefined(); // not awaited
    expect(sink).toHaveBeenCalledWith(V, U);
    resolve();

    setAnalyticsSinkForTests(() => {
      throw new Error('boom');
    });
    expect(() => notifyLearnerChanged(V, U)).not.toThrow();
    setAnalyticsSinkForTests(() => Promise.reject(new Error('boom')));
    expect(() => notifyLearnerChanged(V, U)).not.toThrow();

    const quiet = vi.fn(async () => {});
    setAnalyticsSinkForTests(quiet);
    notifyLearnerChanged(undefined, U);
    notifyLearnerChanged(V, '');
    expect(quiet).not.toHaveBeenCalled();
  });

  it('is a no-op when the app container has no analytics (unit tests)', () => {
    setAnalyticsSinkForTests(undefined);
    expect(() => notifyLearnerChanged(V, U)).not.toThrow();
  });
});

describe('learning write paths notify analytics after their write', () => {
  it('quiz submit', async () => {
    const svc = make(AttemptService, {
      courseRepo: {getCourseVersionStatus: async () => 'active'},
      quizRepository: {getById: async () => ({details: {}})},
      submissionRepository: {
        get: async () => null,
        create: async () => '64b000000000000000000004',
        update: async () => {},
      },
      save: async () => ({status: 'saved'}),
      userQuizMetricsRepository: {
        get: async () => ({_id: 'm1', attempts: [{attemptId: 'a1'}]}),
        update: async () => {},
      },
      _withTransaction: async (fn: any) => fn({}),
      _grade: async () => ({gradingStatus: 'FAILED', overallFeedback: []}),
      attemptRepository: {getById: async () => null},
      progressRepository: {isItemCompleted: async () => true},
      _buildGradingResult: (_q: unknown, g: any) => ({
        gradingStatus: g.gradingStatus,
      }),
    });
    // submit builds ObjectIds from these, so they must be hex.
    const user = '64b000000000000000000002';
    const res = await check(
      () =>
        svc.submit(
          user,
          '64b000000000000000000003',
          '64b000000000000000000001',
          [],
          false,
          C,
          V,
        ),
      [[V, user]],
    );
    expect(res).toEqual({gradingStatus: 'FAILED'});
  });

  it('lesson start', async () => {
    const svc = make(ProgressService, {
      contentLockService: {assertOpenForUser: async () => {}},
      assertNoRewatchPending: async () => {},
      ...tx('watch-1'),
    });
    expect(await check(() => svc.startItem(U, C, V, 'm', 's', 'i'))).toBe(
      'watch-1',
    );
  });

  const stopStubs = (completed: boolean) => ({
    courseRepo: {
      readVersion: async () => ({courseId: {toString: () => C}}),
      getCourseVersionStatus: async () => 'active',
    },
    progressRepository: {
      findProgress: async () => ({}),
      isItemCompleted: async () => completed,
    },
    itemRepo: {readItemById: async () => ({type: 'VIDEO'})},
    getCourseSettingService: () => ({
      isLinearProgressionEnabled: async () => true,
    }),
    contentLockService: {assertOpenForUser: async () => {}},
    validateProgressPositionOrPreviousCompleted: async () => {},
    isRewatchOfCurrentVideo: () => true,
    finishRewatch: async () => {},
    ...tx(undefined),
  });

  it('lesson finish (stop)', async () => {
    const svc = make(ProgressService, stopStubs(false));
    await check(() => svc.stopItem(U, C, V, 'i', 's', 'm', 'w'));
  });

  it('required rewatch finished (stop on a completed video)', async () => {
    const svc = make(ProgressService, stopStubs(true));
    await check(() => svc.stopItem(U, C, V, 'i', 's', 'm', 'w'));
  });

  const skipStubs = {
    contentLockService: {assertOpenForUser: async () => {}},
    itemRepo: {readItem: async () => ({})},
    progressRepository: {
      findProgress: async () => ({}),
      isItemCompleted: async () => true,
      updateProgress: async () => ({}),
    },
    courseRepo: {readVersion: async () => ({})},
    getNextItemInSequence: async () => ({
      itemId: 'n',
      moduleId: 'm',
      sectionId: 's',
    }),
  };

  it('skip (only when it owns its transaction)', async () => {
    const svc = make(ProgressService, skipStubs);
    await check(() => svc.skipItem(U, C, V, 'i'));
    // Inside a caller's transaction nothing is committed yet: no notification.
    await check(() => svc.skipItem(U, C, V, 'i', undefined, {} as any), []);
  });

  it('admin advance', async () => {
    const svc = make(ProgressService, tx(true));
    expect(
      await check(() => svc.adminAdvanceStuckStudent(U, C, V, 'r', 'x')),
    ).toBe(true);
  });

  it('enrol (own transaction only) and unenrol', async () => {
    const svc = make(EnrollmentService, {
      ...tx({status: 'ENROLLED'}),
      userRepo: {findById: async () => null},
    });
    expect(
      await check(() => svc.enrollUser(U, C, V, 'STUDENT' as any)),
    ).toEqual({status: 'ENROLLED'});
    // With a caller's session the caller commits; the roster check picks it up.
    setAnalyticsSinkForTests(vi.fn(async () => {}));
    await expect(
      svc.enrollUser(
        U,
        C,
        V,
        'STUDENT' as any,
        false,
        undefined,
        undefined,
        {} as any,
      ),
    ).rejects.toThrow();

    const un = make(EnrollmentService, tx({enrollment: null}));
    expect(await check(() => un.unenrollUser(U, C, V, {} as any))).toEqual({
      enrollment: null,
    });
  });

  it('proctoring incident', async () => {
    const svc = make(AnomalyService, tx({_id: 'a1'}));
    expect(
      await check(() =>
        svc.recordAnomaly(U, {courseId: C, versionId: V} as any),
      ),
    ).toEqual({_id: 'a1'});
  });

  it('study view', async () => {
    const lesson = {moduleId: 'm', sectionId: 's', itemId: 'i'};
    const svc = make(StudyProgressService, {
      activeEnrollment: async () => ({role: 'STUDENT'}),
      lessons: async () => [
        {
          ...lesson,
          type: 'VIDEO',
          studyMode: {allowed: true},
          lock: {locked: false},
        },
      ],
      studyViewRepo: {recordView: async () => {}},
    });
    expect(await check(() => svc.recordStudyView(U, C, V, lesson))).toEqual({
      recorded: true,
    });
  });

  it('rewind and fast-forward tracking', async () => {
    const svc = make(UserActivityEventService, tx({_id: 'e1'}));
    expect(
      await check(() => svc.CreateUserActivityEvent(U, {versionId: V} as any)),
    ).toEqual({_id: 'e1'});
  });
});
