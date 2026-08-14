import { describe, it, expect, vi } from 'vitest';
import { PacingService } from '../services/PacingService.js';

const base = new Date('2026-01-01T00:00:00Z').getTime();
const day = (n: number) => new Date(base + n * 24 * 60 * 60 * 1000);

function makeService(opts: {
  enrollment?: any;
  courseVersion?: any;
  completedIds?: string[];
  items?: Record<string, any>;
}) {
  const service: any = Object.create(PacingService.prototype);

  service.enrollmentRepo = {
    findEnrollment: async () => opts.enrollment || null,
  };

  service.progressRepository = {
    getCompletedItems: async () => opts.completedIds || [],
    getCompletedItemsInWindow: async () => [],
  };

  service.courseRepo = {
    readVersion: async () => opts.courseVersion || null,
  };

  service.itemRepo = {
    readItemsGroup: async (id: string) => {
      if (id === 'group1') return { items: [{ _id: 'item1', isHidden: false }] };
      return null;
    },
    readItem: async (versionId: string, id: string) => {
      return opts.items?.[id] || null;
    },
  };

  return service as PacingService;
}

describe('PacingService Teacher Deadline Dual Pacing Unit Tests', () => {
  it('should distinguish student deadline and teacher deadline pacing plans', async () => {
    const mockToday = day(0);
    vi.useFakeTimers();
    vi.setSystemTime(mockToday);

    const enrollment = {
      enrollmentDate: day(-5),
      targetCompletionDate: day(10), // Student deadline: 10 days left
    };

    const courseVersion = {
      _id: 'version123',
      teacherDeadline: day(20), // Teacher deadline: 20 days left
      modules: [
        {
          moduleId: 'mod1',
          name: 'Module 1',
          difficulty: 'easy',
          sections: [{ itemsGroupId: 'group1' }]
        }
      ]
    };

    const items = {
      item1: { type: 'BLOG', details: { estimatedReadTimeInMinutes: 100 } }
    };

    const service = makeService({
      enrollment,
      courseVersion,
      completedIds: [],
      items
    });

    // 1. Plan for student (should use student deadline of 10 days)
    const studentPlan = await service.getPacingPlan('user123', 'course123', 'version123');
    expect(studentPlan.hasTarget).toBe(true);
    expect(studentPlan.targetCompletionDate?.getTime()).toBe(day(10).getTime());
    expect(studentPlan.teacherDeadline?.getTime()).toBe(day(20).getTime());
    expect(studentPlan.daysLeft).toBe(10);
    expect(studentPlan.requiredMinutesPerDay).toBe(10); // 100 / 10

    // 2. Plan for teacher (should force teacher deadline of 20 days)
    const teacherPlan = await service.getPacingPlan('user123', 'course123', 'version123', undefined, true);
    expect(teacherPlan.hasTarget).toBe(true);
    expect(teacherPlan.targetCompletionDate?.getTime()).toBe(day(20).getTime());
    expect(teacherPlan.teacherDeadline?.getTime()).toBe(day(20).getTime());
    expect(teacherPlan.daysLeft).toBe(20);
    expect(teacherPlan.requiredMinutesPerDay).toBe(5); // 100 / 20

    vi.useRealTimers();
  });
});
