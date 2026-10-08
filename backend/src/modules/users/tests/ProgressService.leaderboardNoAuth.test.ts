import { describe, it, expect } from 'vitest';
import { ProgressService } from '#users/services/ProgressService.js';
import { NoAuthLeaderboardCache } from '#users/services/NoAuthLeaderboardCache.js';

/**
 * Unit tests for the public (no-auth) leaderboard in
 * ProgressService.getLeaderboardNoAuth.
 *
 * DI is bypassed; the four repository calls the method makes are stubbed and
 * record which students they were asked about, so the tests can check that
 * settled finishers are not looked up again.
 */

const COURSE_ID = '6a14258a4fa5339bade5d732';
const VERSION_ID = '6a14258a4fa5339bade5d733';

const at = (iso: string) => new Date(iso);

interface Fixture {
  enrollments: any[];
  progress: any[];
  users: any[];
}

function makeService(fixture: Fixture, ttlMs = 0) {
  const calls = { builds: 0, progressLookups: [] as string[][], userLookups: [] as string[][] };
  const service: any = Object.create(ProgressService.prototype);
  service.courseRepo = {
    read: async () => {
      calls.builds++;
      return { name: 'Course' };
    },
    readVersion: async () => ({ version: 'v1' }),
  };
  service.enrollmentRepo = {
    getLeaderboardEnrollments: async () => fixture.enrollments,
  };
  service.progressRepository = {
    getCompletionForUsers: async (_c: string, _v: string, ids: string[]) => {
      calls.progressLookups.push([...ids].sort());
      return fixture.progress.filter(p => ids.includes(p.userId));
    },
  };
  service.userRepo = {
    getNamesAndEmailsByIds: async (ids: string[]) => {
      calls.userLookups.push([...ids].sort());
      return fixture.users.filter(u => ids.includes(u._id));
    },
  };
  // ttl 0 → every call rebuilds, so finisher reuse is visible.
  service._noAuthLeaderboardCache = new NoAuthLeaderboardCache(ttlMs);
  return { service: service as ProgressService, calls };
}

const user = (id: string, firstName: string) => ({
  _id: id,
  firstName,
  lastName: '',
  email: `${firstName.toLowerCase()}@example.com`,
});

describe('ProgressService.getLeaderboardNoAuth', () => {
  it('ranks ties at the same % by earliest completion, completed before not completed', async () => {
    const { service } = makeService({
      enrollments: [
        { userId: 'A', percentCompleted: 100, enrollmentDate: at('2026-09-01T00:00:00Z') },
        { userId: 'B', percentCompleted: 100, enrollmentDate: at('2026-09-01T00:00:00Z') },
        { userId: 'C', percentCompleted: 100, enrollmentDate: at('2026-09-01T00:00:00Z') },
        { userId: 'D', percentCompleted: 40, enrollmentDate: null },
      ],
      progress: [
        { userId: 'A', completed: true, completedAt: at('2026-09-20T10:00:00Z') },
        { userId: 'B', completed: true, completedAt: at('2026-09-05T10:00:00Z') },
        // C is at 100% but the progress row has no completion yet.
        { userId: 'C', completed: false, completedAt: null },
        { userId: 'D', completed: false, completedAt: null },
      ],
      users: [user('A', 'Asha'), user('B', 'Bala'), user('C', 'Chitra'), user('D', 'Dev')],
    });

    const res = await service.getLeaderboardNoAuth(COURSE_ID, VERSION_ID);

    expect(res.data.map(r => r.userId)).toEqual(['B', 'A', 'C', 'D']);
    expect(res.data.map(r => r.rank)).toEqual([1, 2, 3, 4]);
    expect(res.total).toBe(4);
    // Same fields and display format as before the fix; email is the real address.
    expect(res.data[0]).toEqual({
      rank: 1,
      userId: 'B',
      userName: 'Bala',
      email: 'bala@example.com',
      completionPercentage: 100,
      completedAt: '05/09/2026, 03:30:00 pm',
      enrolledAt: '01/09/2026, 05:30:00 am',
    });
    expect(res.data[2].completedAt).toBe('Not completed yet');
    expect(res.data[3].enrolledAt).toBe('No enrollment date');
  });

  it('returns each user\'s real email address, unmasked', async () => {
    const { service } = makeService({
      enrollments: ['A', 'B', 'C', 'D'].map(id => ({
        userId: id,
        percentCompleted: 10,
        enrollmentDate: null,
      })),
      progress: [],
      users: [
        { _id: 'A', firstName: 'Meena', email: 'meenakshi.v@gmail.com' },
        { _id: 'B', firstName: 'X', email: 'x@iitrpr.ac.in' },
        { _id: 'C', firstName: 'Malformed', email: 'not-an-email' },
        { _id: 'D', firstName: 'NoEmail' },
      ],
    });

    const res = await service.getLeaderboardNoAuth(COURSE_ID, VERSION_ID);
    const emailById = new Map(res.data.map(r => [r.userId, r.email]));

    expect(emailById.get('A')).toBe('meenakshi.v@gmail.com');
    expect(emailById.get('B')).toBe('x@iitrpr.ac.in');
    expect(emailById.get('C')).toBe('not-an-email');
    expect(emailById.get('D')).toBe('No email');
  });

  it('does not look up settled finishers again on the next rebuild', async () => {
    const fixture: Fixture = {
      enrollments: [
        { userId: 'A', percentCompleted: 100, enrollmentDate: null },
        { userId: 'B', percentCompleted: 60, enrollmentDate: null },
      ],
      progress: [
        { userId: 'A', completed: true, completedAt: at('2026-09-10T00:00:00Z') },
        { userId: 'B', completed: false, completedAt: null },
      ],
      users: [user('A', 'Asha'), user('B', 'Bala')],
    };
    const { service, calls } = makeService(fixture);

    await service.getLeaderboardNoAuth(COURSE_ID, VERSION_ID);
    // B moves on; A's name changes in the DB but A is settled, so the row is reused.
    fixture.enrollments[1].percentCompleted = 80;
    fixture.users[0].firstName = 'Renamed';
    const res = await service.getLeaderboardNoAuth(COURSE_ID, VERSION_ID);

    expect(calls.builds).toBe(2);
    expect(calls.progressLookups).toEqual([['A', 'B'], ['B']]);
    expect(calls.userLookups).toEqual([['A', 'B'], ['B']]);
    expect(res.data.map(r => [r.userId, r.completionPercentage])).toEqual([
      ['A', 100],
      ['B', 80],
    ]);
    expect(res.data[0].userName).toBe('Asha');
  });

  it('rebuilds a finisher who drops below 100% or leaves the course', async () => {
    const fixture: Fixture = {
      enrollments: [
        { userId: 'A', percentCompleted: 100, enrollmentDate: null },
        { userId: 'B', percentCompleted: 100, enrollmentDate: null },
      ],
      progress: [
        { userId: 'A', completed: true, completedAt: at('2026-09-10T00:00:00Z') },
        { userId: 'B', completed: true, completedAt: at('2026-09-11T00:00:00Z') },
      ],
      users: [user('A', 'Asha'), user('B', 'Bala')],
    };
    const { service, calls } = makeService(fixture);

    await service.getLeaderboardNoAuth(COURSE_ID, VERSION_ID);
    // New items were added to the course: A falls to 90%. B unenrolls.
    fixture.enrollments = [{ userId: 'A', percentCompleted: 90, enrollmentDate: null }];
    const res = await service.getLeaderboardNoAuth(COURSE_ID, VERSION_ID);

    expect(calls.progressLookups[1]).toEqual(['A']);
    expect(res.data.map(r => [r.userId, r.completionPercentage])).toEqual([['A', 90]]);

    // B re-enrolls and is back at 100%: rebuilt, not served from the old row.
    fixture.enrollments.push({ userId: 'B', percentCompleted: 100, enrollmentDate: null });
    await service.getLeaderboardNoAuth(COURSE_ID, VERSION_ID);
    expect(calls.progressLookups[2]).toEqual(['A', 'B']);
  });

  it('keeps looking up a 100% student until their completion date is recorded', async () => {
    const fixture: Fixture = {
      enrollments: [{ userId: 'A', percentCompleted: 100, enrollmentDate: null }],
      progress: [{ userId: 'A', completed: false, completedAt: null }],
      users: [user('A', 'Asha')],
    };
    const { service, calls } = makeService(fixture);

    await service.getLeaderboardNoAuth(COURSE_ID, VERSION_ID);
    fixture.progress[0] = { userId: 'A', completed: true, completedAt: at('2026-09-12T00:00:00Z') };
    const res = await service.getLeaderboardNoAuth(COURSE_ID, VERSION_ID);
    await service.getLeaderboardNoAuth(COURSE_ID, VERSION_ID);

    expect(calls.progressLookups).toEqual([['A'], ['A'], []]);
    expect(res.data[0].completedAt).toBe('12/09/2026, 05:30:00 am');
  });

  it('serves repeat and concurrent requests from one build while the response is fresh', async () => {
    const { service, calls } = makeService(
      {
        enrollments: [{ userId: 'A', percentCompleted: 10, enrollmentDate: null }],
        progress: [],
        users: [user('A', 'Asha')],
      },
      60_000,
    );

    await Promise.all([
      service.getLeaderboardNoAuth(COURSE_ID, VERSION_ID),
      service.getLeaderboardNoAuth(COURSE_ID, VERSION_ID),
    ]);
    await service.getLeaderboardNoAuth(COURSE_ID, VERSION_ID);

    expect(calls.builds).toBe(1);
  });

  it('does not cache a failed build', async () => {
    const fixture: Fixture = { enrollments: [], progress: [], users: [] };
    const { service } = makeService(fixture, 60_000);

    await expect(service.getLeaderboardNoAuth(COURSE_ID, VERSION_ID)).rejects.toThrow(
      /No enrollments found/,
    );
    fixture.enrollments = [{ userId: 'A', percentCompleted: 10, enrollmentDate: null }];
    fixture.users = [user('A', 'Asha')];
    const res = await service.getLeaderboardNoAuth(COURSE_ID, VERSION_ID);
    expect(res.data).toHaveLength(1);
  });

  it('pages only when a limit is given, and always reports the total', async () => {
    const enrollments = ['A', 'B', 'C', 'D', 'E'].map((id, i) => ({
      userId: id,
      percentCompleted: 90 - i * 10,
      enrollmentDate: null,
    }));
    const { service } = makeService({
      enrollments,
      progress: [],
      users: enrollments.map(e => user(e.userId, e.userId)),
    });

    const all = await service.getLeaderboardNoAuth(COURSE_ID, VERSION_ID);
    const page2 = await service.getLeaderboardNoAuth(COURSE_ID, VERSION_ID, 2, 2);

    expect(all.data).toHaveLength(5);
    expect(page2.data.map(r => [r.rank, r.userId])).toEqual([
      [3, 'C'],
      [4, 'D'],
    ]);
    expect(page2.total).toBe(5);
  });

  it('lists each student once despite duplicate progress rows and multiple cohorts', async () => {
    const { service } = makeService({
      enrollments: [
        // Same student in two cohorts of the version: the furthest one counts.
        { userId: 'A', percentCompleted: 30, enrollmentDate: null },
        { userId: 'A', percentCompleted: 100, enrollmentDate: null },
        // Enrolled but no progress row yet.
        { userId: 'B', percentCompleted: 0, enrollmentDate: null },
      ],
      progress: [
        { userId: 'A', completed: false, completedAt: null },
        { userId: 'A', completed: true, completedAt: at('2026-09-15T00:00:00Z') },
        { userId: 'A', completed: true, completedAt: at('2026-09-14T00:00:00Z') },
      ],
      users: [user('A', 'Asha'), user('B', 'Bala')],
    });

    const res = await service.getLeaderboardNoAuth(COURSE_ID, VERSION_ID);

    expect(res.data.map(r => r.userId)).toEqual(['A', 'B']);
    expect(res.data[0]).toMatchObject({
      completionPercentage: 100,
      completedAt: '14/09/2026, 05:30:00 am',
    });
    expect(res.data[1].completedAt).toBe('Not completed yet');
  });
});
