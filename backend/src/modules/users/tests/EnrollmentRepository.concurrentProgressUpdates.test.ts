import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { ObjectId } from 'mongodb';
import { MongoDatabase } from '#shared/database/providers/mongo/MongoDatabase.js';
import { EnrollmentRepository } from '#shared/database/providers/mongo/repositories/EnrollmentRepository.js';
import { BaseService } from '#shared/classes/BaseService.js';

/**
 * Forces real MongoDB write conflicts by hammering the same enrollment
 * document with concurrent transactional updates, to prove
 * BaseService._withTransaction's retry actually recovers from them now
 * that EnrollmentRepository preserves the TransientTransactionError label
 * instead of discarding it when wrapping the error (see
 * TRANSACTION_RETRY_GAP.md). Before that fix, a meaningful fraction of
 * these concurrent calls would fail outright instead of retrying.
 */
class ConcurrencyTestService extends BaseService {
  constructor(
    db: MongoDatabase,
    private enrollmentRepo: EnrollmentRepository,
  ) {
    super(db);
  }

  async bumpProgress(enrollmentId: string, percentCompleted: number) {
    return this._withTransaction(session =>
      this.enrollmentRepo.updateProgressPercentById(
        enrollmentId,
        percentCompleted,
        undefined,
        undefined,
        session,
      ),
    );
  }
}

describe('BaseService._withTransaction retry under real concurrent contention', () => {
  let db: MongoDatabase;
  let service: ConcurrencyTestService;
  const enrollmentId = new ObjectId();

  beforeAll(async () => {
    db = new MongoDatabase(process.env.DB_URL, 'enrollment_concurrency_test');
    await db.connect();
    const enrollmentRepo = new EnrollmentRepository(db);
    service = new ConcurrencyTestService(db, enrollmentRepo);

    const enrollments = await db.getCollection('enrollment');
    await enrollments.insertOne({
      _id: enrollmentId,
      userId: new ObjectId(),
      courseId: new ObjectId(),
      courseVersionId: new ObjectId(),
      role: 'STUDENT',
      status: 'ACTIVE',
      enrollmentDate: new Date(),
      percentCompleted: 0,
      isDeleted: false,
    } as any);
  });

  afterAll(async () => {
    await db.disconnect();
  });

  it('retries transient write conflicts instead of surfacing them, under 15 concurrent updates to the same document', async () => {
    const CONCURRENT_UPDATES = 15;

    const results = await Promise.allSettled(
      Array.from({ length: CONCURRENT_UPDATES }, (_, i) =>
        service.bumpProgress(enrollmentId.toString(), i + 1),
      ),
    );

    const rejected = results.filter(r => r.status === 'rejected');
    if (rejected.length > 0) {
      // Surface what actually failed, rather than just a count, if this
      // ever regresses.
      console.error(
        'Concurrent progress updates that failed instead of retrying:',
        rejected.map(r => (r as PromiseRejectedResult).reason?.message ?? r),
      );
    }

    expect(rejected).toHaveLength(0);
  });
});
