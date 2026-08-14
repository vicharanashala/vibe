import { describe, it, expect, vi } from 'vitest';
import { PacingGroupService } from '../services/PacingGroupService.js';
import { BadRequestError } from 'routing-controllers';

const base = new Date('2026-01-01T00:00:00Z').getTime();
const day = (n: number) => new Date(base + n * 24 * 60 * 60 * 1000);

function makeService(opts: {
  group?: any;
  enrollments?: Map<string, any>;
  courseRepo?: any;
  progressRepo?: any;
  itemRepo?: any;
}) {
  const service: any = Object.create(PacingGroupService.prototype);

  service.pacingGroupRepo = {
    getByUserId: async () => opts.group || null,
    upsertForUser: vi.fn(),
    clearForUser: vi.fn(),
  };

  service.enrollmentRepo = {
    findEnrollment: async (userId: string, courseId: string, courseVersionId: string, cohortId?: string) => {
      const key = `${courseId}:${courseVersionId}`;
      return opts.enrollments?.get(key) || null;
    }
  };

  service.courseRepo = opts.courseRepo || {
    read: async (id: string) => ({ _id: id, name: `Course ${id}` }),
    readVersion: async (versionId: string) => null,
  };

  service.progressRepository = opts.progressRepo || {
    getCompletedItems: async () => [],
    getCompletedItemsInWindow: async () => [],
  };

  service.itemRepo = opts.itemRepo || {
    readItemsGroup: async () => null,
    readItem: async () => null,
  };

  return service as PacingGroupService;
}

describe('PacingGroupService Unit Tests', () => {
  describe('setCombinedPacingTarget', () => {
    it('should throw BadRequestError if courseSelections is empty', async () => {
      const service = makeService({});
      await expect(
        service.setCombinedPacingTarget('user123', day(10), [])
      ).rejects.toThrow(BadRequestError);
    });

    it('should throw BadRequestError if enrollment is not found', async () => {
      const service = makeService({
        enrollments: new Map() // No enrollments mapped
      });
      await expect(
        service.setCombinedPacingTarget('user123', day(10), [
          { courseId: 'courseA', courseVersionId: 'versionA' }
        ])
      ).rejects.toThrow(BadRequestError);
    });

    it('should save pacing group if selections correspond to valid active enrollments', async () => {
      const enrollments = new Map([
        ['courseA:versionA', { enrollmentDate: day(0) }]
      ]);
      const service = makeService({ enrollments });

      const targetDate = day(10);
      const selections = [{ courseId: 'courseA', courseVersionId: 'versionA' }];

      await service.setCombinedPacingTarget('user123', targetDate, selections);

      expect(service['pacingGroupRepo'].upsertForUser).toHaveBeenCalledWith(
        'user123',
        targetDate,
        selections
      );
    });
  });

  describe('clearCombinedPacingTarget', () => {
    it('should call repository to clear pacing group for user', async () => {
      const service = makeService({});
      await service.clearCombinedPacingTarget('user123');
      expect(service['pacingGroupRepo'].clearForUser).toHaveBeenCalledWith('user123');
    });
  });

  describe('getCombinedPacingPlan', () => {
    it('should return empty/hasSelection: false details if user has no group', async () => {
      const service = makeService({ group: null });
      const plan = await service.getCombinedPacingPlan('user123');
      expect(plan.hasSelection).toBe(false);
      expect(plan.courses).toHaveLength(0);
    });

    it('should calculate combined pacing correctly', async () => {
      // Mocking target deadline 10 days from base day(0) (which is when we test)
      const mockToday = day(0);
      vi.useFakeTimers();
      vi.setSystemTime(mockToday);

      const group = {
        userId: 'user123',
        targetCompletionDate: day(10),
        courseSelections: [
          { courseId: 'courseA', courseVersionId: 'versionA' },
          { courseId: 'courseB', courseVersionId: 'versionB' }
        ]
      };

      const enrollments = new Map([
        ['courseA:versionA', { enrollmentDate: day(-5) }],
        ['courseB:versionB', { enrollmentDate: day(-3) }]
      ]);

      const courseRepo = {
        read: async (id: string) => ({ _id: id, name: `Course ${id}` }),
        readVersion: async (versionId: string) => {
          if (versionId === 'versionA') {
            return {
              _id: 'versionA',
              modules: [
                {
                  moduleId: 'modA1',
                  sections: [{ itemsGroupId: 'groupA1' }]
                }
              ]
            };
          }
          if (versionId === 'versionB') {
            return {
              _id: 'versionB',
              modules: [
                {
                  moduleId: 'modB1',
                  sections: [{ itemsGroupId: 'groupB1' }]
                }
              ]
            };
          }
          return null;
        }
      };

      const itemRepo = {
        readItemsGroup: async (id: string) => {
          if (id === 'groupA1') {
            return {
              items: [{ _id: 'itemA1', isHidden: false }, { _id: 'itemA2', isHidden: false }]
            };
          }
          if (id === 'groupB1') {
            return {
              items: [{ _id: 'itemB1', isHidden: false }]
            };
          }
          return null;
        },
        readItem: async (versionId: string, id: string) => {
          // itemA1 = 20 mins, itemA2 = 30 mins, itemB1 = 50 mins
          if (id === 'itemA1') return { type: 'BLOG', details: { estimatedReadTimeInMinutes: 20 } };
          if (id === 'itemA2') return { type: 'BLOG', details: { estimatedReadTimeInMinutes: 30 } };
          if (id === 'itemB1') return { type: 'BLOG', details: { estimatedReadTimeInMinutes: 50 } };
          return null;
        }
      };

      // progress: itemA1 is completed
      const progressRepo = {
        getCompletedItems: async (userId: string, courseId: string, versionId: string) => {
          if (versionId === 'versionA') return ['itemA1'];
          return [];
        },
        getCompletedItemsInWindow: async () => ['itemA1'] // completed in last 7 days
      };

      const service = makeService({
        group,
        enrollments,
        courseRepo,
        itemRepo,
        progressRepo
      });

      const plan = await service.getCombinedPacingPlan('user123');

      // Expected output verification:
      // courseA: remaining = itemA2 (30 mins). itemsRemaining = 1
      // courseB: remaining = itemB1 (50 mins). itemsRemaining = 1
      // total effort remaining = 80 mins
      // daysLeft = 10 days (from day(0) to day(10))
      // requiredMinutesPerDay = 8 mins/day (80 / 10)
      expect(plan.hasSelection).toBe(true);
      expect(plan.daysLeft).toBe(10);
      expect(plan.totalEffortMinutesRemaining).toBe(80);
      expect(plan.requiredMinutesPerDay).toBe(8);

      expect(plan.courses).toHaveLength(2);
      const breakdownA = plan.courses.find(c => c.courseId === 'courseA');
      const breakdownB = plan.courses.find(c => c.courseId === 'courseB');

      expect(breakdownA).toBeDefined();
      expect(breakdownA?.effortMinutesRemaining).toBe(30);
      expect(breakdownA?.itemsRemaining).toBe(1);
      expect(breakdownA?.shareOfTotal).toBe(30 / 80);

      expect(breakdownB).toBeDefined();
      expect(breakdownB?.effortMinutesRemaining).toBe(50);
      expect(breakdownB?.itemsRemaining).toBe(1);
      expect(breakdownB?.shareOfTotal).toBe(50 / 80);

      vi.useRealTimers();
    });
  });
});
