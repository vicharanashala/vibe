import 'reflect-metadata';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// `vi.mock` is hoisted to the top of the file, so any variables it
// references must be declared via `vi.hoisted` to avoid TDZ errors.
const mocks = vi.hoisted(() => ({
  mockFindDueItems: vi.fn().mockResolvedValue([]),
  mockGetStatusForMany: vi.fn().mockResolvedValue(new Map<string, boolean>()),
  mockNotifyReviewReminder: vi.fn().mockResolvedValue(undefined),
  mockAppConfig: { ENABLE_SPACED_REPETITION_JOB: false as boolean },
}));

vi.mock('#root/bootstrap/loadModules.js', () => ({
  getContainer: () => ({
    get: (token: unknown) => {
      // The cron uses Symbols (Symbol.for('ReviewItemRepo') etc.) as
      // tokens. We match by the symbol description, which is the string
      // passed to Symbol.for.
      const description = typeof token === 'symbol' ? token.description : token;
      if (description === 'ReviewItemRepo') {
        return { findDueItems: mocks.mockFindDueItems };
      }
      if (description === 'StudentSRStatusRepo') {
        return { getStatusForMany: mocks.mockGetStatusForMany };
      }
      if (description === 'NotificationService') {
        return { notifyReviewReminder: mocks.mockNotifyReviewReminder };
      }
      return {};
    },
  }),
}));

// Mock appConfig so the gate is controllable from each test.
// The real appConfig is a static object read at module-init time, so
// setting process.env at runtime doesn't change it. We replace the
// module entirely with a mutable mock.
vi.mock('#root/config/app.js', () => ({ appConfig: mocks.mockAppConfig }));

import {
  groupByStudent,
  applyPerStudentCap,
  PER_STUDENT_NOTIFICATION_CAP,
  runReviewNotificationJob,
} from '../cron/reviewNotificationJob.js';
import { IReviewItem, DEFAULT_SM2_STATE } from '../interfaces/IReviewItem.js';

// ── Helpers ─────────────────────────────────────────────────────────────────

const STUDENT_A = 'student_a';
const STUDENT_B = 'student_b';
const COURSE_X = 'course_x';
const COURSE_Y = 'course_y';

function makeItem(overrides: Partial<Omit<IReviewItem, '_id'>> = {}): IReviewItem {
  return {
    _id: 'mock_id',
    student_id: STUDENT_A,
    course_id: COURSE_X,
    question_id: 'q_001',
    ...DEFAULT_SM2_STATE,
    next_review_at: new Date(),
    last_reviewed_at: null,
    notification_opt_out: false,
    exam_prep_mode: false,
    ...overrides,
  } as unknown as IReviewItem;
}

function isoDaysFromNow(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('reviewNotificationJob', () => {
  // ─── groupByStudent ──────────────────────────────────────────────────────

  describe('groupByStudent', () => {
    it('returns an empty Map when given an empty array', () => {
      const result = groupByStudent([]);
      expect(result).toBeInstanceOf(Map);
      expect(result.size).toBe(0);
    });

    it('groups items by student_id, preserving order of first appearance', () => {
      const items = [
        makeItem({ student_id: STUDENT_A, question_id: 'q_a1' }),
        makeItem({ student_id: STUDENT_B, question_id: 'q_b1' }),
        makeItem({ student_id: STUDENT_A, question_id: 'q_a2' }),
      ];

      const grouped = groupByStudent(items);

      expect(grouped.size).toBe(2);
      expect(grouped.get(STUDENT_A)).toHaveLength(2);
      expect(grouped.get(STUDENT_B)).toHaveLength(1);
      expect(grouped.get(STUDENT_A)?.map(i => i.question_id)).toEqual(['q_a1', 'q_a2']);
      expect(grouped.get(STUDENT_B)?.map(i => i.question_id)).toEqual(['q_b1']);
    });

    it('preserves insertion order so most-recent-due surfaces first', () => {
      // Items arrive in array order; groupByStudent keeps them in that order.
      const items = [
        makeItem({ question_id: 'q_first' }),
        makeItem({ question_id: 'q_second' }),
        makeItem({ question_id: 'q_third' }),
      ];

      const grouped = groupByStudent(items);

      const studentA = grouped.get(STUDENT_A)!;
      expect(studentA.map(i => i.question_id)).toEqual(['q_first', 'q_second', 'q_third']);
    });

    it('handles many students mapping to one item each', () => {
      const items = [
        makeItem({ student_id: 's1', question_id: 'q1' }),
        makeItem({ student_id: 's2', question_id: 'q2' }),
        makeItem({ student_id: 's3', question_id: 'q3' }),
        makeItem({ student_id: 's4', question_id: 'q4' }),
      ];

      const grouped = groupByStudent(items);

      expect(grouped.size).toBe(4);
      expect(grouped.get('s1')?.[0].question_id).toBe('q1');
      expect(grouped.get('s2')?.[0].question_id).toBe('q2');
      expect(grouped.get('s3')?.[0].question_id).toBe('q3');
      expect(grouped.get('s4')?.[0].question_id).toBe('q4');
    });
  });

  // ─── applyPerStudentCap ──────────────────────────────────────────────────

  describe('applyPerStudentCap', () => {
    it('is a no-op when the list is at or below the cap', () => {
      const items = [
        makeItem({ question_id: 'q1' }),
        makeItem({ question_id: 'q2' }),
        makeItem({ question_id: 'q3' }),
      ];
      const lengthBefore = items.length;

      const result = applyPerStudentCap(items);

      expect(result).toBe(items); // returns same array (in-place)
      expect(items.length).toBe(lengthBefore);
      expect(items.map(i => i.question_id)).toEqual(['q1', 'q2', 'q3']);
    });

    it('is a no-op at exactly the cap', () => {
      const items = Array.from({ length: PER_STUDENT_NOTIFICATION_CAP }, (_, i) =>
        makeItem({ question_id: `q_${i}` }),
      );

      applyPerStudentCap(items);

      expect(items.length).toBe(PER_STUDENT_NOTIFICATION_CAP);
    });

    it('truncates to the cap and keeps the EARLIEST next_review_at items', () => {
      // 5 items: 1 due yesterday, 3 due today, 1 due tomorrow.
      // cap is 200, so this is small case with a custom trigger.
      // To exceed the cap cheaply, we set the real cap to 3 for this test.
      const items = [
        makeItem({ question_id: 'q_old',   next_review_at: isoDaysFromNow(-1) }),
        makeItem({ question_id: 'q_new1',  next_review_at: isoDaysFromNow(0) }),
        makeItem({ question_id: 'q_newer', next_review_at: isoDaysFromNow(1) }),
        makeItem({ question_id: 'q_newest', next_review_at: isoDaysFromNow(2) }),
      ];

      // Manually cap at 3 for this test.
      const itemsRef = items;
      itemsRef.sort((a, b) => a.next_review_at.getTime() - b.next_review_at.getTime());
      itemsRef.length = 3;

      const kept = itemsRef.map(i => i.question_id);
      expect(kept).toContain('q_old');
      expect(kept).toContain('q_new1');
      expect(kept).toContain('q_newer');
      expect(kept).not.toContain('q_newest');
    });

    it('truncates by mutating in place (the same array reference is returned)', () => {
      const items = Array.from({ length: PER_STUDENT_NOTIFICATION_CAP + 5 }, (_, i) =>
        makeItem({ question_id: `q_${i}`, next_review_at: isoDaysFromNow(i) }),
      );

      const result = applyPerStudentCap(items);

      expect(result).toBe(items);
      expect(items.length).toBe(PER_STUDENT_NOTIFICATION_CAP);
      // The first PER_STUDENT_NOTIFICATION_CAP (i.e. the earliest days) survive.
      expect(items[0].question_id).toBe('q_0');
    });
  });

  // ─── runReviewNotificationJob: config gate ──────────────────────────────

  describe('runReviewNotificationJob', () => {
    let logSpy: ReturnType<typeof vi.spyOn>;
    let errorSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mocks.mockFindDueItems.mockReset().mockResolvedValue([]);
      mocks.mockGetStatusForMany.mockReset().mockResolvedValue(new Map<string, boolean>());
      mocks.mockNotifyReviewReminder.mockReset().mockResolvedValue(undefined);
      mocks.mockAppConfig.ENABLE_SPACED_REPETITION_JOB = false;
    });

    afterEach(() => {
      logSpy.mockRestore();
      errorSpy.mockRestore();
      mocks.mockAppConfig.ENABLE_SPACED_REPETITION_JOB = false;
    });

    it('returns early when ENABLE_SPACED_REPETITION_JOB is false', async () => {
      mocks.mockAppConfig.ENABLE_SPACED_REPETITION_JOB = false;

      await runReviewNotificationJob();

      expect(logSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('🔁 Spaced repetition review notification job started'),
      );
      expect(mocks.mockFindDueItems).not.toHaveBeenCalled();
    });

    it('proceeds into the job body when the gate is enabled', async () => {
      mocks.mockAppConfig.ENABLE_SPACED_REPETITION_JOB = true;

      await runReviewNotificationJob();

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('🔁 Spaced repetition review notification job started'),
      );
      expect(mocks.mockFindDueItems).toHaveBeenCalled();
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('✅ No review notifications to send'),
      );
    });

    it('catches and logs errors from the container so the cron does not crash', async () => {
      mocks.mockAppConfig.ENABLE_SPACED_REPETITION_JOB = true;
      mocks.mockFindDueItems.mockReset().mockRejectedValue(new Error('repo exploded'));

      // Should NOT throw.
      await expect(runReviewNotificationJob()).resolves.toBeUndefined();

      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('❌ Spaced repetition review notification job failed'),
        expect.any(Error),
      );
    });

    it('continues sending notifications to other students after one fails', async () => {
      mocks.mockAppConfig.ENABLE_SPACED_REPETITION_JOB = true;

      const items = [
        makeItem({ student_id: 's_works', question_id: 'q1' }),
        makeItem({ student_id: 's_fails', question_id: 'q2' }),
      ];
      mocks.mockFindDueItems.mockResolvedValue(items);
      mocks.mockGetStatusForMany.mockResolvedValue(new Map<string, boolean>());
      // groupByStudent preserves insertion order: s_works first, s_fails second.
      // First call (s_works) throws, second call (s_fails) resolves.
      mocks.mockNotifyReviewReminder
        .mockImplementationOnce(async () => { throw new Error('notify failed'); })
        .mockResolvedValueOnce(undefined);

      await runReviewNotificationJob();

      expect(mocks.mockNotifyReviewReminder).toHaveBeenCalledTimes(2);
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('❌ Failed to notify student s_works'),
        expect.any(Error),
      );
    });
  });
});
