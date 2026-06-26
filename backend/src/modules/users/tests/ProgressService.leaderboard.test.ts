import { describe, it, expect } from 'vitest';
import { ProgressService } from '#users/services/ProgressService.js';

/**
 * Unit tests for the two-league leaderboard ranking in ProgressService.getLeaderboard.
 *
 * We bypass DI and stub only the three repositories the method touches:
 *   - progressRepository (getAllProgressForCourseVersion, getWeeklyEffortByCourseVersion)
 *   - enrollmentRepo (getEnrollmentsByCourseVersion)
 *   - userRepo (getUsersByIds)
 */

const COURSE_ID = 'course1';
const VERSION_ID = 'version1';

const base = new Date('2026-01-01T00:00:00Z').getTime();
const day = (n: number) => new Date(base + n * 24 * 60 * 60 * 1000);

function makeService(opts: {
  progress: any[];
  enrollments: any[];
  effort: Map<string, { weeklyItems: number; weeklyMinutes: number }>;
  users: any[];
  firstActivity?: Map<string, Date>;
}) {
  const service: any = Object.create(ProgressService.prototype);
  service.progressRepository = {
    getAllProgressForCourseVersion: async () => opts.progress,
    getWeeklyEffortByCourseVersion: async () => opts.effort,
    // Empty by default → days-to-complete falls back to enrollmentDate.
    getFirstActivityByCourseVersion: async () => opts.firstActivity ?? new Map(),
  };
  service.enrollmentRepo = {
    getEnrollmentsByCourseVersion: async () => opts.enrollments,
  };
  service.userRepo = {
    getUsersByIds: async () => opts.users,
  };
  return service as ProgressService;
}

const user = (id: string, firstName: string) => ({ _id: id, firstName, lastName: '' });

describe('ProgressService.getLeaderboard — two-league ranking', () => {
  it('ranks finishers by days-to-complete, neutralizing different start dates', async () => {
    // A: enrolled day 0, completed day 10 -> 10 days
    // B: enrolled day 20, completed day 24 -> 4 days (later absolute completion, faster elapsed)
    const service = makeService({
      progress: [
        { userId: 'A', completed: true, completedAt: day(10) },
        { userId: 'B', completed: true, completedAt: day(24) },
      ],
      enrollments: [
        { userId: 'A', percentCompleted: 100, enrollmentDate: day(0) },
        { userId: 'B', percentCompleted: 100, enrollmentDate: day(20) },
      ],
      effort: new Map(),
      users: [user('A', 'Alice'), user('B', 'Bob')],
    });

    const res = await service.getLeaderboard('A', COURSE_ID, VERSION_ID);

    expect(res.finishers.data.map(e => e.userId)).toEqual(['B', 'A']);
    expect(res.finishers.data[0].daysToComplete).toBe(4);
    expect(res.finishers.data[1].daysToComplete).toBe(10);
    expect(res.active.data).toHaveLength(0);
  });

  it('ranks active learners by rolling 7-day effort over lifetime %', async () => {
    // C: 50% lifetime but 8 items this week
    // D: 80% lifetime but only 2 items this week
    const service = makeService({
      progress: [
        { userId: 'C', completed: false },
        { userId: 'D', completed: false },
      ],
      enrollments: [
        { userId: 'C', percentCompleted: 50, enrollmentDate: day(0) },
        { userId: 'D', percentCompleted: 80, enrollmentDate: day(0) },
      ],
      effort: new Map([
        ['C', { weeklyItems: 8, weeklyMinutes: 120 }],
        ['D', { weeklyItems: 2, weeklyMinutes: 30 }],
      ]),
      users: [user('C', 'Carol'), user('D', 'Dave')],
    });

    const res = await service.getLeaderboard('C', COURSE_ID, VERSION_ID);

    expect(res.finishers.data).toHaveLength(0);
    expect(res.active.data.map(e => e.userId)).toEqual(['C', 'D']);
    expect(res.active.data[0].weeklyItems).toBe(8);
  });

  it('every 100% learner is a finisher; one without a finish date sorts last', async () => {
    // E: 100% WITH a finish date -> ranked by days-to-complete
    // F: 100% but completedAt missing -> still a finisher, sorts last (no days)
    const service = makeService({
      progress: [
        { userId: 'E', completed: true, completedAt: day(5) },
        { userId: 'F', completed: false, completedAt: null },
      ],
      enrollments: [
        { userId: 'E', percentCompleted: 100, enrollmentDate: day(0) },
        { userId: 'F', percentCompleted: 100, enrollmentDate: day(0) },
      ],
      effort: new Map(),
      users: [user('E', 'Eve'), user('F', 'Frank')],
    });

    const res = await service.getLeaderboard('E', COURSE_ID, VERSION_ID);

    // Both are finishers; E (has days) ranks above F (no finish date -> last).
    expect(res.finishers.data.map(e => e.userId)).toEqual(['E', 'F']);
    expect(res.finishers.data[1].daysToComplete).toBeNull();
    expect(res.active.data).toHaveLength(0);
  });

  it('paginates the active league and reports myStats with the right league', async () => {
    const progress = [];
    const enrollments = [];
    const effort = new Map<string, { weeklyItems: number; weeklyMinutes: number }>();
    const users = [];
    for (let i = 0; i < 15; i++) {
      const id = `u${i}`;
      progress.push({ userId: id, completed: false });
      enrollments.push({ userId: id, percentCompleted: 10, enrollmentDate: day(0) });
      effort.set(id, { weeklyItems: 15 - i, weeklyMinutes: 0 }); // u0 highest effort
      users.push(user(id, `U${i}`));
    }
    const service = makeService({ progress, enrollments, effort, users });

    const res = await service.getLeaderboard('u3', COURSE_ID, VERSION_ID, 1, 10);

    expect(res.active.total).toBe(15);
    expect(res.active.totalPages).toBe(2);
    expect(res.active.data).toHaveLength(10);
    expect(res.active.data[0].userId).toBe('u0'); // most effort ranks first
    expect(res.myStats?.userId).toBe('u3');
    expect(res.myStats?.league).toBe('active');
    expect(res.myStats?.rank).toBe(4);
  });
});
