import 'reflect-metadata';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {ObjectId} from 'mongodb';
import {appConfig} from '#root/config/app.js';
import {StruggleDetectionService} from '../services/StruggleDetectionService.js';

const STUDENT = new ObjectId().toString();
const INSTRUCTOR_A = new ObjectId();
const INSTRUCTOR_B = new ObjectId();
const COURSE = new ObjectId().toString();
const VERSION = new ObjectId().toString();
const QUIZ = new ObjectId().toString();
const GROUP = new ObjectId();
const Q1 = new ObjectId().toString();
const Q2 = new ObjectId().toString();
const NOW = new Date('2026-10-05T10:00:00Z');

/**
 * In-memory stand-in for StruggleStreakRepository with the same rules:
 * failures add one, a success resets the streak and its alert, and an alert
 * can be claimed once per streak from the threshold.
 */
function fakeStreakRepo() {
  const streaks = new Map<string, any>();
  return {
    streaks,
    recordFailure: vi.fn(async (k: any, now: Date) => {
      const s = streaks.get(k.questionId) ?? {
        _id: new ObjectId(),
        questionId: new ObjectId(k.questionId),
        consecutiveFailures: 0,
        alertedAt: null,
      };
      s.consecutiveFailures += 1;
      s.lastAttemptAt = now;
      streaks.set(k.questionId, s);
      return {...s};
    }),
    recordSuccess: vi.fn(async (k: any) => {
      const s = streaks.get(k.questionId);
      if (s) {
        s.consecutiveFailures = 0;
        s.alertedAt = null;
      }
    }),
    claimAlert: vi.fn(async (id: ObjectId, threshold: number, now: Date) => {
      const s = [...streaks.values()].find(v => v._id.equals(id));
      if (!s || s.alertedAt || s.consecutiveFailures < threshold) return false;
      s.alertedAt = now;
      return true;
    }),
  };
}

function buildService(overrides: Record<string, any> = {}) {
  const streakRepo = fakeStreakRepo();
  const deps = {
    streakRepo,
    questionRepo: {
      getByIds: vi.fn(async (ids: string[]) =>
        ids.map(id => ({
          _id: new ObjectId(id),
          text:
            id === Q1
              ? 'What does   gradient descent minimise?'
              : 'Second question',
        })),
      ),
    },
    userRepo: {
      findById: vi.fn(async () => ({firstName: 'Test', lastName: 'Student'})),
      getNamesAndEmailsByIds: vi.fn(async (ids: string[]) =>
        ids.map(id => ({_id: id, email: `${id}@vibe.test`})),
      ),
    },
    enrollmentRepo: {
      getInstructorIdsByVersion: vi.fn(async () => [
        INSTRUCTOR_A,
        INSTRUCTOR_B,
      ]),
    },
    courseRepo: {
      read: vi.fn(async () => ({name: 'Intro to ML'})),
      findVersionByItemGroupId: vi.fn(async () => ({
        modules: [
          {
            name: 'Basics',
            sections: [{name: 'Week 1', itemsGroupId: GROUP}],
          },
        ],
      })),
    },
    itemRepo: {
      findItemsGroupByItemId: vi.fn(async () => ({_id: GROUP})),
      readItem: vi.fn(async () => ({name: 'Quiz 1'})),
    },
    notificationRepo: {createMany: vi.fn(async () => [])},
    mailService: {sendMail: vi.fn(async () => ({}))},
    ...overrides,
  };
  const service = new StruggleDetectionService(
    deps.streakRepo as any,
    deps.questionRepo as any,
    deps.userRepo as any,
    deps.enrollmentRepo as any,
    deps.courseRepo as any,
    deps.itemRepo as any,
    deps.notificationRepo as any,
    deps.mailService as any,
  );
  return {service, ...deps};
}

type Status = 'CORRECT' | 'INCORRECT' | 'PARTIAL';
const attempt = (...results: [string, Status][]) => ({
  userId: STUDENT,
  courseId: COURSE,
  courseVersionId: VERSION,
  quizId: QUIZ,
  feedback: results.map(([questionId, status]) => ({questionId, status})),
});

describe('StruggleDetectionService.recordQuizResults', () => {
  const originalFlag = appConfig.ENABLE_STRUGGLE_ALERTS;
  beforeEach(() => {
    appConfig.ENABLE_STRUGGLE_ALERTS = true;
  });
  afterEach(() => {
    appConfig.ENABLE_STRUGGLE_ALERTS = originalFlag;
    vi.restoreAllMocks();
  });

  it('does nothing while the feature is switched off', async () => {
    appConfig.ENABLE_STRUGGLE_ALERTS = false;
    const {service, streakRepo} = buildService();
    expect(
      await service.recordQuizResults(attempt([Q1, 'INCORRECT']), NOW),
    ).toBeUndefined();
    expect(streakRepo.recordFailure).not.toHaveBeenCalled();
  });

  it('Fail → Fail → Fail: alerts instructors once and nudges the student', async () => {
    const {service, notificationRepo, mailService} = buildService();
    expect(
      await service.recordQuizResults(attempt([Q1, 'INCORRECT']), NOW),
    ).toBeUndefined();
    expect(
      await service.recordQuizResults(attempt([Q1, 'INCORRECT']), NOW),
    ).toBeUndefined();
    expect(notificationRepo.createMany).not.toHaveBeenCalled();

    const nudge = await service.recordQuizResults(
      attempt([Q1, 'INCORRECT']),
      NOW,
    );
    expect(nudge).toEqual({
      questionCount: 1,
      message: expect.stringContaining('some concepts take time to master'),
    });

    expect(notificationRepo.createMany).toHaveBeenCalledTimes(1);
    const [notifications] = notificationRepo.createMany.mock.calls[0] as any[];
    expect(notifications).toHaveLength(2); // one per instructor
    expect(notifications[0]).toMatchObject({
      userId: INSTRUCTOR_A,
      type: 'student_struggling',
      title: 'Test Student may need help',
      message:
        'Test Student has answered "What does gradient descent minimise?" wrongly 3 times in a row (Basics › Week 1 › Quiz 1).',
      courseId: new ObjectId(COURSE),
      courseVersionId: new ObjectId(VERSION),
      read: false,
      createdAt: NOW,
      extra: {
        studentId: STUDENT,
        studentName: 'Test Student',
        questionId: Q1,
        quizId: QUIZ,
        failureCount: 3,
        moduleName: 'Basics',
        sectionName: 'Week 1',
        quizName: 'Quiz 1',
      },
    });

    expect(mailService.sendMail).toHaveBeenCalledTimes(2);
    const [email] = mailService.sendMail.mock.calls[0] as any[];
    expect(email.subject).toBe('Test Student may need help in Intro to ML');
    expect(email.text).toContain(
      `/teacher/courses/enrollments?courseId=${COURSE}&versionId=${VERSION}&student=${STUDENT}`,
    );
  });

  it('Fail ×3 → Fail → Fail: no further alerts in the same streak, but the student is still nudged', async () => {
    const {service, notificationRepo} = buildService();
    for (let i = 0; i < 3; i++) {
      await service.recordQuizResults(attempt([Q1, 'INCORRECT']), NOW);
    }
    const fourth = await service.recordQuizResults(
      attempt([Q1, 'INCORRECT']),
      NOW,
    );
    const fifth = await service.recordQuizResults(
      attempt([Q1, 'INCORRECT']),
      NOW,
    );
    expect(fourth?.questionCount).toBe(1);
    expect(fifth?.questionCount).toBe(1);
    expect(notificationRepo.createMany).toHaveBeenCalledTimes(1);
  });

  it('Fail → Fail → Pass resets the streak; the next three failures alert again', async () => {
    const {service, notificationRepo} = buildService();
    await service.recordQuizResults(attempt([Q1, 'INCORRECT']), NOW);
    await service.recordQuizResults(attempt([Q1, 'INCORRECT']), NOW);
    await service.recordQuizResults(attempt([Q1, 'CORRECT']), NOW);
    expect(
      await service.recordQuizResults(attempt([Q1, 'INCORRECT']), NOW),
    ).toBeUndefined();
    await service.recordQuizResults(attempt([Q1, 'INCORRECT']), NOW);
    expect(notificationRepo.createMany).not.toHaveBeenCalled();

    await service.recordQuizResults(attempt([Q1, 'INCORRECT']), NOW);
    expect(notificationRepo.createMany).toHaveBeenCalledTimes(1);

    // After an alerted streak, a pass and three more failures alert again.
    await service.recordQuizResults(attempt([Q1, 'CORRECT']), NOW);
    for (let i = 0; i < 3; i++) {
      await service.recordQuizResults(attempt([Q1, 'INCORRECT']), NOW);
    }
    expect(notificationRepo.createMany).toHaveBeenCalledTimes(2);
  });

  it('counts a partly correct answer as a failure', async () => {
    const {service, notificationRepo} = buildService();
    for (let i = 0; i < 3; i++) {
      await service.recordQuizResults(attempt([Q1, 'PARTIAL']), NOW);
    }
    expect(notificationRepo.createMany).toHaveBeenCalledTimes(1);
  });

  it('tracks each question separately and alerts for every question that crosses together', async () => {
    const {service, notificationRepo} = buildService();
    for (let i = 0; i < 3; i++) {
      await service.recordQuizResults(
        attempt([Q1, 'INCORRECT'], [Q2, 'INCORRECT']),
        NOW,
      );
    }
    const [notifications] = notificationRepo.createMany.mock.calls[0] as any[];
    // 2 instructors × 2 questions.
    expect(notifications).toHaveLength(4);
    expect(new Set(notifications.map((n: any) => n.extra.questionId))).toEqual(
      new Set([Q1, Q2]),
    );
  });

  it('counts a question once even if it appears twice in the feedback', async () => {
    const {service, streakRepo} = buildService();
    await service.recordQuizResults(
      attempt([Q1, 'INCORRECT'], [Q1, 'INCORRECT']),
      NOW,
    );
    expect(streakRepo.streaks.get(Q1).consecutiveFailures).toBe(1);
  });

  it('never alerts the student themselves, even if they are also an instructor', async () => {
    const {service, notificationRepo} = buildService({
      enrollmentRepo: {
        getInstructorIdsByVersion: vi.fn(async () => [new ObjectId(STUDENT)]),
      },
    });
    for (let i = 0; i < 3; i++) {
      await service.recordQuizResults(attempt([Q1, 'INCORRECT']), NOW);
    }
    expect(notificationRepo.createMany).not.toHaveBeenCalled();
  });

  it('keeps the in-app alert and the nudge when email is not configured', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const {service, notificationRepo} = buildService({
      mailService: {
        sendMail: vi.fn(async () => {
          throw new Error('SMTP is not configured');
        }),
      },
    });
    for (let i = 0; i < 2; i++) {
      await service.recordQuizResults(attempt([Q1, 'INCORRECT']), NOW);
    }
    const nudge = await service.recordQuizResults(
      attempt([Q1, 'INCORRECT']),
      NOW,
    );
    expect(nudge?.questionCount).toBe(1);
    expect(notificationRepo.createMany).toHaveBeenCalledTimes(1);
  });

  it('never throws, so a quiz submission cannot fail because of alerts', async () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    const {service} = buildService({
      streakRepo: {
        recordFailure: vi.fn(async () => {
          throw new Error('database down');
        }),
        recordSuccess: vi.fn(),
        claimAlert: vi.fn(),
      },
    });
    await expect(
      service.recordQuizResults(attempt([Q1, 'INCORRECT']), NOW),
    ).resolves.toBeUndefined();
    expect(consoleError).toHaveBeenCalled();
  });
});
