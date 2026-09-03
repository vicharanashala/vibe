import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { ObjectId } from 'mongodb';
import { MongoDatabase } from '#shared/database/providers/mongo/MongoDatabase.js';
import { EnrollmentRepository } from '#shared/database/providers/mongo/repositories/EnrollmentRepository.js';

/**
 * Repository-level tests for the nightly progress recompute
 * (bulkUpdateCompletedItemsCountForCourseVersion), which rewrites every
 * enrollment's completedItemsCount/percentCompleted from watch-time rows.
 *
 * The recompute must agree with the live completion path
 * (ProgressRepository.getCompletedItems): a completion recorded against a
 * cohort belongs to that cohort's enrollment, and hidden/deleted items are
 * excluded. Runs against the in-memory Mongo replica set started in
 * test/globalSetup.ts.
 */
describe('EnrollmentRepository.bulkUpdateCompletedItemsCountForCourseVersion', () => {
  let db: MongoDatabase;
  let repo: EnrollmentRepository;

  const courseId = new ObjectId();
  const courseVersionId = new ObjectId();
  const cohortId = new ObjectId();
  const otherCohortId = new ObjectId();

  // Four items in the version, so each completion is worth 25%.
  const itemA = new ObjectId();
  const itemB = new ObjectId();
  const itemC = new ObjectId();
  const itemD = new ObjectId();

  // Enrolled through a cohort, with two items genuinely completed.
  const cohortLearner = new ObjectId();
  // No cohort at all (legacy enrollment), with two items completed.
  const soloLearner = new ObjectId();
  // In a cohort, but their watch-time rows are still open (no endTime).
  const unfinishedLearner = new ObjectId();

  const enrollmentIds = {
    cohortLearner: new ObjectId(),
    soloLearner: new ObjectId(),
    unfinishedLearner: new ObjectId(),
  };

  const watchTime = (
    userId: ObjectId,
    itemId: ObjectId,
    cohort: ObjectId | null,
    closed = true,
  ) => ({
    userId,
    courseId,
    courseVersionId,
    itemId,
    cohortId: cohort,
    startTime: new Date('2026-08-22T10:00:00Z'),
    ...(closed ? { endTime: new Date('2026-08-22T10:10:00Z') } : {}),
    isDeleted: false,
  });

  beforeAll(async () => {
    db = new MongoDatabase(
      process.env.DB_URL,
      'enrollment_repo_bulk_recompute_cohort_test',
    );
    await db.connect();
    repo = new EnrollmentRepository(db);

    const courseVersions = await db.getCollection('newCourseVersion');
    await courseVersions.insertOne({
      _id: courseVersionId,
      totalItems: 4,
    } as any);

    const enrollments = await db.getCollection('enrollment');
    await enrollments.insertMany([
      {
        _id: enrollmentIds.cohortLearner,
        userId: cohortLearner,
        courseId,
        courseVersionId,
        cohortId,
        role: 'STUDENT',
        status: 'ACTIVE',
        enrollmentDate: new Date('2026-08-01'),
        percentCompleted: 0,
        completedItemsCount: 0,
        isDeleted: false,
      },
      {
        _id: enrollmentIds.soloLearner,
        userId: soloLearner,
        courseId,
        courseVersionId,
        role: 'STUDENT',
        status: 'ACTIVE',
        enrollmentDate: new Date('2026-08-01'),
        percentCompleted: 0,
        completedItemsCount: 0,
        isDeleted: false,
      },
      {
        _id: enrollmentIds.unfinishedLearner,
        userId: unfinishedLearner,
        courseId,
        courseVersionId,
        cohortId,
        role: 'STUDENT',
        status: 'ACTIVE',
        enrollmentDate: new Date('2026-08-01'),
        percentCompleted: 0,
        completedItemsCount: 0,
        isDeleted: false,
      },
    ] as any);

    const watchTimes = await db.getCollection('watchTime');
    await watchTimes.insertMany([
      // Genuine cohort-scoped completions.
      watchTime(cohortLearner, itemA, cohortId),
      watchTime(cohortLearner, itemB, cohortId),
      // Same item twice — must be counted once, not twice.
      watchTime(cohortLearner, itemB, cohortId),
      // A completion belonging to a different cohort's enrollment: this
      // learner has no enrollment there, so it must not inflate any count.
      watchTime(cohortLearner, itemC, otherCohortId),

      // Legacy rows with no cohort at all.
      watchTime(soloLearner, itemA, null),
      watchTime(soloLearner, itemD, null),

      // Started but never stopped — not a completion.
      watchTime(unfinishedLearner, itemA, cohortId, false),
    ] as any);
  }, 60000);

  afterAll(async () => {
    await db.disconnect?.();
  });

  it('counts cohort-scoped completions instead of zeroing them out', async () => {
    const result = await repo.bulkUpdateCompletedItemsCountForCourseVersion({
      courseVersionId: courseVersionId.toString(),
      courseId: courseId.toString(),
    });

    expect(result.totalCount).toBe(3);

    const enrollments = await db.getCollection('enrollment');
    const updated = await enrollments.findOne({
      _id: enrollmentIds.cohortLearner,
    } as any);

    // Two distinct items completed within this cohort, out of four.
    expect(updated?.completedItemsCount).toBe(2);
    expect(updated?.percentCompleted).toBe(50);
  });

  it('still counts legacy completions recorded without a cohort', async () => {
    await repo.bulkUpdateCompletedItemsCountForCourseVersion({
      courseVersionId: courseVersionId.toString(),
      courseId: courseId.toString(),
    });

    const enrollments = await db.getCollection('enrollment');
    const updated = await enrollments.findOne({
      _id: enrollmentIds.soloLearner,
    } as any);

    expect(updated?.completedItemsCount).toBe(2);
    expect(updated?.percentCompleted).toBe(50);
  });

  it('does not count watch-time rows that were never closed', async () => {
    await repo.bulkUpdateCompletedItemsCountForCourseVersion({
      courseVersionId: courseVersionId.toString(),
      courseId: courseId.toString(),
    });

    const enrollments = await db.getCollection('enrollment');
    const updated = await enrollments.findOne({
      _id: enrollmentIds.unfinishedLearner,
    } as any);

    expect(updated?.completedItemsCount).toBe(0);
    expect(updated?.percentCompleted).toBe(0);
  });
});
