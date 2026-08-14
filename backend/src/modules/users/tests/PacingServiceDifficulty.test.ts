import { describe, it, expect, vi } from 'vitest';
import { PacingService } from '../services/PacingService.js';

const base = new Date('2026-01-01T00:00:00Z').getTime();
const day = (n: number) => new Date(base + n * 24 * 60 * 60 * 1000);

function makeService(opts: {
  enrollment?: any;
  courseVersion?: any;
  completedIds?: string[];
  recentCompletedIds?: string[];
  items?: Record<string, any>;
}) {
  const service: any = Object.create(PacingService.prototype);

  service.enrollmentRepo = {
    findEnrollment: async () => opts.enrollment || null,
  };

  service.progressRepository = {
    getCompletedItems: async () => opts.completedIds || [],
    getCompletedItemsInWindow: async () => opts.recentCompletedIds || [],
  };

  service.courseRepo = {
    readVersion: async () => opts.courseVersion || null,
  };

  service.itemRepo = {
    readItemsGroup: async (id: string) => {
      if (id === 'groupEasy') return { items: [{ _id: 'itemEasy', isHidden: false }] };
      if (id === 'groupModerate') return { items: [{ _id: 'itemModerate', isHidden: false }] };
      if (id === 'groupDifficult') return { items: [{ _id: 'itemDifficult', isHidden: false }] };
      if (id === 'groupHard') return { items: [{ _id: 'itemHard', isHidden: false }] };
      return null;
    },
    readItem: async (versionId: string, id: string) => {
      return opts.items?.[id] || null;
    },
  };

  return service as PacingService;
}

describe('PacingService Difficulty Scaling Unit Tests', () => {
  it('should scale remaining and completed effort according to module difficulty', async () => {
    // 10 days remaining from day(0) to target day(10)
    const mockToday = day(0);
    vi.useFakeTimers();
    vi.setSystemTime(mockToday);

    const enrollment = {
      enrollmentDate: day(-5),
      targetCompletionDate: day(10),
    };

    const courseVersion = {
      _id: 'version123',
      modules: [
        {
          moduleId: 'modEasy',
          name: 'Easy Module',
          difficulty: 'easy',
          sections: [{ itemsGroupId: 'groupEasy' }]
        },
        {
          moduleId: 'modModerate',
          name: 'Moderate Module',
          difficulty: 'moderate',
          sections: [{ itemsGroupId: 'groupModerate' }]
        },
        {
          moduleId: 'modDifficult',
          name: 'Difficult Module',
          difficulty: 'difficult',
          sections: [{ itemsGroupId: 'groupDifficult' }]
        },
        {
          moduleId: 'modHard',
          name: 'Hard Module',
          difficulty: 'hard',
          sections: [{ itemsGroupId: 'groupHard' }]
        }
      ]
    };

    const items = {
      itemEasy: { type: 'BLOG', details: { estimatedReadTimeInMinutes: 100 } },
      itemModerate: { type: 'BLOG', details: { estimatedReadTimeInMinutes: 100 } },
      itemDifficult: { type: 'BLOG', details: { estimatedReadTimeInMinutes: 100 } },
      itemHard: { type: 'BLOG', details: { estimatedReadTimeInMinutes: 100 } }
    };

    // Easy completed, others remaining
    const completedIds = ['itemEasy'];
    // Moderate and difficult completed in window
    const recentCompletedIds = ['itemEasy', 'itemModerate'];

    const service = makeService({
      enrollment,
      courseVersion,
      completedIds,
      recentCompletedIds,
      items
    });

    const plan = await service.getPacingPlan('user123', 'course123', 'version123');

    // Easy module: itemEasy completed, effortMinutesRemaining = 0
    const easyBreakdown = plan.moduleBreakdown.find(m => m.moduleId === 'modEasy');
    expect(easyBreakdown?.effortMinutesRemaining).toBe(0);

    // Moderate module: itemModerate remaining, effortMinutesRemaining = 100 * 1.05 = 105
    const moderateBreakdown = plan.moduleBreakdown.find(m => m.moduleId === 'modModerate');
    expect(moderateBreakdown?.effortMinutesRemaining).toBe(105);

    // Difficult module: itemDifficult remaining, effortMinutesRemaining = 100 * 1.10 = 110
    const difficultBreakdown = plan.moduleBreakdown.find(m => m.moduleId === 'modDifficult');
    expect(difficultBreakdown?.effortMinutesRemaining).toBe(110);

    // Hard module: itemHard remaining, effortMinutesRemaining = 100 * 1.10 = 110
    const hardBreakdown = plan.moduleBreakdown.find(m => m.moduleId === 'modHard');
    expect(hardBreakdown?.effortMinutesRemaining).toBe(110);

    // Total effort remaining: 0 (easy) + 105 (mod) + 110 (diff) + 110 (hard) = 325
    expect(plan.requiredMinutesPerDay).toBe(Math.ceil(325 / 10)); // 33 minutes per day

    vi.useRealTimers();
  });
});
