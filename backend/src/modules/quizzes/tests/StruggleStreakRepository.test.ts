import {describe, it, expect, beforeAll, afterAll, beforeEach} from 'vitest';
import {ObjectId} from 'mongodb';
import {MongoDatabase} from '#shared/database/providers/mongo/MongoDatabase.js';
import {
  StreakKey,
  StruggleStreakRepository,
} from '../repositories/providers/mongodb/StruggleStreakRepository.js';

/**
 * Repository tests for struggling-student failure streaks (#1109), against
 * the in-memory Mongo replica set started in test/globalSetup.ts.
 */
describe('StruggleStreakRepository', () => {
  let db: MongoDatabase;
  let repo: StruggleStreakRepository;

  const key = (overrides: Partial<StreakKey> = {}): StreakKey => ({
    userId: '6a0000000000000000000001',
    courseId: '6a0000000000000000000002',
    courseVersionId: '6a0000000000000000000003',
    questionId: '6a0000000000000000000004',
    quizId: '6a0000000000000000000005',
    ...overrides,
  });
  const at = (minute: number) => new Date(Date.UTC(2026, 9, 5, 10, minute));
  const fail = (k = key(), minute = 0) => repo.recordFailure(k, at(minute));

  beforeAll(async () => {
    db = new MongoDatabase(
      process.env.DB_URL,
      'struggle_streak_repository_test',
    );
    await db.connect();
    repo = new StruggleStreakRepository(db);
  });

  beforeEach(async () => {
    await (await db.getCollection('question_struggle_streaks')).deleteMany({});
  });

  afterAll(async () => {
    await db.disconnect?.();
  });

  it('counts wrong answers in a row, starting a new streak at one', async () => {
    expect((await fail()).consecutiveFailures).toBe(1);
    expect((await fail()).consecutiveFailures).toBe(2);
    const third = await fail(key(), 2);
    expect(third).toMatchObject({
      consecutiveFailures: 3,
      alertedAt: null,
      lastAttemptAt: at(2),
      createdAt: at(0),
    });
    expect(third.userId).toEqual(new ObjectId(key().userId));
  });

  it('keeps separate streaks per question and per course version', async () => {
    await fail();
    await fail();
    expect(
      (await fail(key({questionId: '6a00000000000000000000aa'})))
        .consecutiveFailures,
    ).toBe(1);
    expect(
      (await fail(key({courseVersionId: '6a00000000000000000000bb'})))
        .consecutiveFailures,
    ).toBe(1);
  });

  it('lets exactly one caller claim the alert, and only from the threshold', async () => {
    const first = await fail();
    expect(await repo.claimAlert(first._id!, 3, at(1))).toBe(false);
    await fail();
    const third = await fail();
    const claims = await Promise.all([
      repo.claimAlert(third._id!, 3, at(5)),
      repo.claimAlert(third._id!, 3, at(5)),
    ]);
    expect(claims.filter(Boolean)).toHaveLength(1);
    // A fourth failure in the same streak keeps the alert marker.
    expect((await fail()).alertedAt).toEqual(at(5));
  });

  it('a correct answer resets the streak and its alert, so a new streak can alert again', async () => {
    await fail();
    await fail();
    const third = await fail();
    await repo.claimAlert(third._id!, 3, at(5));

    await repo.recordSuccess(key(), at(6));
    const restart = await fail(key(), 7);
    expect(restart).toMatchObject({consecutiveFailures: 1, alertedAt: null});

    await fail();
    const thirdAgain = await fail();
    expect(await repo.claimAlert(thirdAgain._id!, 3, at(9))).toBe(true);
  });

  it('does not create a streak for a correct answer', async () => {
    await repo.recordSuccess(key(), at(0));
    expect(
      await (
        await db.getCollection('question_struggle_streaks')
      ).countDocuments(),
    ).toBe(0);
  });
});
