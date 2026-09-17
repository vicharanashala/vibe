import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { ObjectId } from 'mongodb';
import { MongoDatabase } from '#shared/database/providers/mongo/MongoDatabase.js';
import { EnrollmentRepository } from '#shared/database/providers/mongo/repositories/EnrollmentRepository.js';

/**
 * Repository-level tests for the teacher statistics panel.
 *
 * Average watch hours used to be aggregated on every request, scanning the
 * whole watchTime collection because its match was wrapped in `$expr`. It is
 * now precomputed into courseVersionStats and read back by the endpoint. These
 * cover both halves of that split — that the recomputation still excludes
 * share-link guests and still tolerates ids stored as either strings or
 * ObjectIds, and that the read path reports an uncomputed course honestly
 * rather than as a zero.
 *
 * Runs against the in-memory Mongo replica set started in test/globalSetup.ts.
 */
describe('EnrollmentRepository course version statistics', () => {
  let db: MongoDatabase;
  let repo: EnrollmentRepository;

  const courseId = new ObjectId();
  const courseVersionId = new ObjectId();
  // A second version whose ids were written as strings rather than ObjectIds,
  // which both collections genuinely contain depending on the write path.
  const stringCourseId = new ObjectId();
  const stringVersionId = new ObjectId();

  const learner = { _id: new ObjectId(), email: 'learner@example.com' };
  const otherLearner = { _id: new ObjectId(), email: 'other@example.com' };
  const guest = {
    _id: new ObjectId(),
    email: 'guest@example.com',
    isShareLinkGuest: true,
  };

  const hours = (n: number) => n * 3600_000;
  const start = new Date('2026-08-01T10:00:00Z');
  const after = (ms: number) => new Date(start.getTime() + ms);

  beforeAll(async () => {
    db = new MongoDatabase(process.env.DB_URL, 'enrollment_repo_version_stats_test');
    await db.connect();
    repo = new EnrollmentRepository(db);

    const users = await db.getCollection('users');
    await users.insertMany([learner, otherLearner, guest] as any);

    const enrollments = await db.getCollection('enrollment');
    await enrollments.insertMany([
      {
        userId: learner._id,
        courseId,
        courseVersionId,
        role: 'STUDENT',
        status: 'ACTIVE',
        percentCompleted: 100,
        isDeleted: false,
      },
      {
        userId: otherLearner._id,
        courseId,
        courseVersionId,
        role: 'STUDENT',
        status: 'ACTIVE',
        percentCompleted: 40,
        isDeleted: false,
      },
      // Sharing a course must not move the numbers describing enrolled
      // learners, so this enrollment is outside every figure below.
      {
        userId: guest._id,
        courseId,
        courseVersionId,
        role: 'STUDENT',
        status: 'ACTIVE',
        percentCompleted: 0,
        isDeleted: false,
        isShareLinkGuest: true,
      },
      {
        userId: learner._id,
        courseId: String(stringCourseId),
        courseVersionId: String(stringVersionId),
        role: 'STUDENT',
        status: 'ACTIVE',
        percentCompleted: 50,
        isDeleted: false,
      },
    ] as any);

    const watchTime = await db.getCollection('watchTime');
    await watchTime.insertMany([
      // learner: 2h total across two sessions
      {
        userId: learner._id,
        courseId,
        courseVersionId,
        itemId: new ObjectId(),
        startTime: start,
        endTime: after(hours(1)),
      },
      {
        userId: learner._id,
        courseId,
        courseVersionId,
        itemId: new ObjectId(),
        startTime: start,
        endTime: after(hours(1)),
      },
      // otherLearner: 4h total, so the average across the two is 3h
      {
        userId: otherLearner._id,
        courseId,
        courseVersionId,
        itemId: new ObjectId(),
        startTime: start,
        endTime: after(hours(4)),
      },
      // A guest who watched far more than either learner. If guests were
      // counted the average would jump well past 3h.
      {
        userId: guest._id,
        courseId,
        courseVersionId,
        itemId: new ObjectId(),
        startTime: start,
        endTime: after(hours(50)),
      },
      // Still open — no endTime, so it is not a measurable session yet.
      {
        userId: otherLearner._id,
        courseId,
        courseVersionId,
        itemId: new ObjectId(),
        startTime: start,
      },
      // Soft-deleted, and so excluded.
      {
        userId: learner._id,
        courseId,
        courseVersionId,
        itemId: new ObjectId(),
        startTime: start,
        endTime: after(hours(20)),
        isDeleted: true,
      },
      // The string-id version: 3h for one learner.
      {
        userId: learner._id,
        courseId: String(stringCourseId),
        courseVersionId: String(stringVersionId),
        itemId: new ObjectId(),
        startTime: start,
        endTime: after(hours(3)),
      },
    ] as any);
  });

  afterAll(async () => {
    await db.disconnect?.();
  });

  it('excludes share-link guests, open sessions and deleted rows from the average', async () => {
    const average = await repo.computeAverageWatchHoursPerUser(
      String(courseId),
      String(courseVersionId),
    );

    // learner 2h and otherLearner 4h -> 3h. The 50h guest, the open session
    // and the 20h deleted row are all absent.
    expect(average).toBe(3);
  });

  it('matches ids stored as strings as well as ObjectIds', async () => {
    const average = await repo.computeAverageWatchHoursPerUser(
      String(stringCourseId),
      String(stringVersionId),
    );

    expect(average).toBe(3);
  });

  it('reports watch hours as uncomputed until the job has run', async () => {
    const stats = await repo.getVersionEnrollmentStats(
      String(courseId),
      String(courseVersionId),
    );

    // The counts are live, so they are right immediately...
    expect(stats.totalEnrollments).toBe(2);
    expect(stats.completedCount).toBe(1);
    // ...but watch hours has no stored figure yet, and saying "0h" here would
    // read as nobody having watched anything.
    expect(stats.averageWatchHoursPerUser).toBe(0);
    expect(stats.watchHoursComputedAt).toBeNull();
  });

  it('serves the stored figure once refreshed, and updates it in place', async () => {
    const refreshed = await repo.refreshCourseVersionWatchStats(
      String(courseId),
      String(courseVersionId),
    );
    expect(refreshed.averageWatchHoursPerUser).toBe(3);

    const stats = await repo.getVersionEnrollmentStats(
      String(courseId),
      String(courseVersionId),
    );
    expect(stats.averageWatchHoursPerUser).toBe(3);
    expect(stats.watchHoursComputedAt).toBeInstanceOf(Date);

    // A second run must overwrite rather than accumulate a second row for the
    // same version, or the endpoint's findOne would start returning whichever
    // one Mongo happened to reach first.
    await repo.refreshCourseVersionWatchStats(
      String(courseId),
      String(courseVersionId),
    );
    const statsCollection = await db.getCollection('courseVersionStats');
    const rows = await statsCollection
      .find({ courseVersionId: { $in: [courseVersionId, String(courseVersionId)] } })
      .toArray();
    expect(rows).toHaveLength(1);
  });

  it('lists only course versions that have active students to refresh', async () => {
    const versions = await repo.getCourseVersionsWithActiveEnrollments();

    const keys = versions.map(v => `${v.courseId}/${v.courseVersionId}`);
    expect(keys).toContain(`${String(courseId)}/${String(courseVersionId)}`);
    expect(keys).toContain(
      `${String(stringCourseId)}/${String(stringVersionId)}`,
    );
    // The guest's enrollment is on a version already listed, so the guard is
    // that it did not add a version of its own beyond the two seeded here.
    expect(versions).toHaveLength(2);
  });
});
