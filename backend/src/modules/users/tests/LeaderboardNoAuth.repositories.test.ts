import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { ObjectId } from 'mongodb';
import { MongoDatabase } from '#shared/database/providers/mongo/MongoDatabase.js';
import { EnrollmentRepository } from '#shared/database/providers/mongo/repositories/EnrollmentRepository.js';
import { ProgressRepository } from '#shared/database/providers/mongo/repositories/ProgressRepository.js';
import { UserRepository } from '#shared/database/providers/mongo/repositories/UserRepository.js';

/**
 * Repository-level tests for the slim reads behind the public leaderboard.
 *
 * Loading whole enrollment, progress and user documents for a large course
 * ran the Cloud Run instance out of memory, so these reads project only the
 * leaderboard's fields. These check the projections hold, that ids stored as
 * either strings or ObjectIds are matched, and that soft-deleted or inactive
 * rows stay out.
 *
 * Runs against the in-memory Mongo replica set started in test/globalSetup.ts.
 */
describe('Public leaderboard repository reads', () => {
  let db: MongoDatabase;
  let enrollmentRepo: EnrollmentRepository;
  let progressRepo: ProgressRepository;
  let userRepo: UserRepository;

  const courseId = new ObjectId();
  const courseVersionId = new ObjectId();
  const otherVersionId = new ObjectId();

  const asha = new ObjectId();
  const bala = new ObjectId();
  const chitra = new ObjectId();

  beforeAll(async () => {
    db = new MongoDatabase(process.env.DB_URL, 'leaderboard_no_auth_repo_test');
    await db.connect();
    enrollmentRepo = new EnrollmentRepository(db);
    progressRepo = new ProgressRepository(db);
    userRepo = new UserRepository(db);

    const users = await db.getCollection('users');
    await users.insertMany([
      { _id: asha, firstName: 'Asha', lastName: 'K', email: 'asha@example.com', firebaseUID: 'f1', roles: ['user'] },
      { _id: bala, firstName: 'Bala', email: 'bala@example.com', firebaseUID: 'f2', roles: ['user'] },
    ] as any);

    const enrollments = await db.getCollection('enrollment');
    await enrollments.insertMany([
      // Two cohorts, both active — both rows come back; the service dedupes.
      { userId: asha, courseId, courseVersionId, cohortId: new ObjectId(), role: 'STUDENT', status: 'ACTIVE', percentCompleted: 100, enrollmentDate: new Date('2026-09-01T00:00:00Z'), isDeleted: false },
      { userId: bala, courseId, courseVersionId, cohortId: null, role: 'STUDENT', status: 'active', percentCompleted: 40, enrollmentDate: new Date('2026-09-02T00:00:00Z') },
      // Excluded: inactive, deleted, instructor, other version.
      { userId: chitra, courseId, courseVersionId, role: 'STUDENT', status: 'INACTIVE', percentCompleted: 90 },
      { userId: chitra, courseId, courseVersionId, role: 'STUDENT', status: 'ACTIVE', percentCompleted: 90, isDeleted: true },
      { userId: chitra, courseId, courseVersionId, role: 'INSTRUCTOR', status: 'ACTIVE', percentCompleted: 0 },
      { userId: chitra, courseId, courseVersionId: otherVersionId, role: 'STUDENT', status: 'ACTIVE', percentCompleted: 50 },
    ] as any);

    const progress = await db.getCollection('progress');
    await progress.insertMany([
      { userId: asha, courseId, courseVersionId, completed: true, completedAt: new Date('2026-09-10T00:00:00Z'), currentItem: new ObjectId(), adminSkips: [{ itemId: new ObjectId(), reason: 'x' }] },
      // Ids written as strings by another write path.
      { userId: bala.toString(), courseId: courseId.toString(), courseVersionId: courseVersionId.toString(), completed: false },
      // Soft-deleted by a version reset — must not count.
      { userId: bala, courseId, courseVersionId, completed: true, completedAt: new Date('2026-08-01T00:00:00Z'), isDeleted: true },
      { userId: chitra, courseId, courseVersionId, completed: true, completedAt: new Date('2026-09-03T00:00:00Z') },
    ] as any);
  });

  afterAll(async () => {
    await db.disconnect?.();
  });

  it('returns only leaderboard fields for active students of the version', async () => {
    const rows = await enrollmentRepo.getLeaderboardEnrollments(
      courseId.toString(),
      courseVersionId.toString(),
    );

    expect(rows.map(r => r.userId.toString()).sort()).toEqual(
      [asha.toString(), bala.toString()].sort(),
    );
    for (const row of rows) {
      expect(Object.keys(row).sort()).toEqual(
        ['enrollmentDate', 'percentCompleted', 'userId'],
      );
    }
  });

  it('returns completion state only for the asked students, skipping soft-deleted rows', async () => {
    const rows = await progressRepo.getCompletionForUsers(
      courseId.toString(),
      courseVersionId.toString(),
      [asha.toString(), bala.toString()],
    );

    const byUser = new Map(rows.map(r => [r.userId, r]));
    expect(rows).toHaveLength(2);
    expect(byUser.get(asha.toString())).toEqual({
      userId: asha.toString(),
      completed: true,
      completedAt: new Date('2026-09-10T00:00:00Z'),
    });
    // String-stored row matched; the soft-deleted completed row is ignored.
    expect(byUser.get(bala.toString())).toEqual({
      userId: bala.toString(),
      completed: false,
      completedAt: null,
    });

    expect(
      await progressRepo.getCompletionForUsers(courseId.toString(), courseVersionId.toString(), []),
    ).toEqual([]);
  });

  it('returns only name and email for users', async () => {
    const users = await userRepo.getNamesAndEmailsByIds([
      asha.toString(),
      bala.toString(),
    ]);

    const byId = new Map(users.map(u => [u._id, u]));
    expect(byId.get(asha.toString())).toEqual({
      _id: asha.toString(),
      firstName: 'Asha',
      lastName: 'K',
      email: 'asha@example.com',
    });
    expect(byId.get(bala.toString())?.firstName).toBe('Bala');
    expect(await userRepo.getNamesAndEmailsByIds([])).toEqual([]);
  });
});
