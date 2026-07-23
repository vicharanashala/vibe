import {afterAll, beforeAll, beforeEach, describe, expect, it} from 'vitest';
import {Db, MongoClient, ObjectId} from 'mongodb';
import {MongoMemoryReplSet} from 'mongodb-memory-server';
import {ReflectionRepository} from '../repositories/providers/mongodb/ReflectionRepository.js';
import {ReflectionService} from '../services/ReflectionService.js';
import type {IReflectionScores} from '../classes/transformers/Reflection.js';

/**
 * End-to-end coverage against a real MongoDB.
 *
 * The unit suite drives the service through an in-memory fake, so the actual
 * queries — the atomic findOneAndUpdate cap guard, the unique-index race, the
 * fewest-reviews-first sort, the stats aggregation — are only exercised here.
 *
 * A replica set (not a standalone) is used because the repository is written to
 * be safe under concurrent writes, and only a replica set exposes the behaviour
 * that would break if it were not.
 */

/** Minimal MongoDatabase stand-in: the repository only calls getCollection. */
class TestDb {
  constructor(private db: Db) {}
  async getCollection<T>(name: string) {
    return this.db.collection<T>(name) as any;
  }
}

const scores = (n: number): IReflectionScores => ({
  understanding: n,
  depth: n,
  clarity: n,
});

let mongo: MongoMemoryReplSet;
let client: MongoClient;
let db: Db;
let repo: ReflectionRepository;
let service: ReflectionService;

const COURSE = new ObjectId().toString();
const VERSION = new ObjectId().toString();

/** Seed a reflection item document so getPolicy can read (or default) it. */
async function makeItem(
  overrides?: Record<string, number>,
): Promise<string> {
  const _id = new ObjectId();
  await db
    .collection('reflection_items')
    .insertOne({_id, type: 'REFLECTION', details: overrides ?? {}});
  return _id.toString();
}

async function submit(
  userId: string,
  itemId: string,
  confidence = 5,
  text = 'This is a sufficiently long reflection body written out so that it comfortably clears the one hundred character minimum enforced by the service.',
) {
  return service.submitReflection({
    userId,
    courseId: COURSE,
    courseVersionId: VERSION,
    itemId,
    text,
    confidence,
  });
}

beforeAll(async () => {
  mongo = await MongoMemoryReplSet.create({replSet: {count: 1}});
  client = new MongoClient(mongo.getUri());
  await client.connect();
  db = client.db('peerReviewsTest');

  const testDb = new TestDb(db) as any;
  repo = new ReflectionRepository(testDb);
  service = new ReflectionService(repo);
}, 60_000);

afterAll(async () => {
  await client?.close();
  await mongo?.stop();
});

beforeEach(async () => {
  const cols = await db.collections();
  await Promise.all(cols.map(c => c.deleteMany({})));
});

describe('peer reviews — real MongoDB', () => {
  it('serves the least-reviewed reflection first', async () => {
    const item = await makeItem();
    const a = await submit(new ObjectId().toString(), item);
    const b = await submit(new ObjectId().toString(), item);

    // Give A one review; B should now be served ahead of A.
    await service.submitReview({
      reviewerId: new ObjectId().toString(),
      reflectionId: a.reflectionId,
      scores: scores(6),
      helpful: false,
    });

    const next = await service.getNextForReview({
      userId: new ObjectId().toString(),
      itemId: item,
    });
    expect(next?.reflectionId).toBe(b.reflectionId);
  });

  it('never serves a reviewer their own reflection', async () => {
    const item = await makeItem();
    const author = new ObjectId().toString();
    await submit(author, item);

    const next = await service.getNextForReview({userId: author, itemId: item});
    expect(next).toBeNull();
  });

  it('rejects a second review of the same reflection by the same peer', async () => {
    const item = await makeItem();
    const {reflectionId} = await submit(new ObjectId().toString(), item);
    const reviewer = new ObjectId().toString();

    await service.submitReview({
      reviewerId: reviewer,
      reflectionId,
      scores: scores(7),
      helpful: false,
    });

    await expect(
      service.submitReview({
        reviewerId: reviewer,
        reflectionId,
        scores: scores(4),
        helpful: false,
      }),
    ).rejects.toThrow(/already reviewed/i);
  });

  it('enforces the review cap atomically and closes the reflection', async () => {
    const item = await makeItem({maxReviewsPerReflection: 3});
    const {reflectionId} = await submit(new ObjectId().toString(), item);

    for (let i = 0; i < 3; i++) {
      await service.submitReview({
        reviewerId: new ObjectId().toString(),
        reflectionId,
        scores: scores(8),
        helpful: false,
      });
    }

    // The 4th must be refused, and the doc must be CLOSED, not merely full.
    await expect(
      service.submitReview({
        reviewerId: new ObjectId().toString(),
        reflectionId,
        scores: scores(8),
        helpful: false,
      }),
    ).rejects.toThrow(/enough reviews/i);

    const doc = await db
      .collection('reflections')
      .findOne({_id: new ObjectId(reflectionId)});
    expect(doc?.status).toBe('CLOSED');
    expect(doc?.reviewCount).toBe(3);
  });

  it('holds concurrent reviews to the cap under a real race', async () => {
    // Ten peers submit at once against a cap of 5; exactly 5 may win.
    const item = await makeItem({maxReviewsPerReflection: 5});
    const {reflectionId} = await submit(new ObjectId().toString(), item);

    const results = await Promise.allSettled(
      Array.from({length: 10}, () =>
        service.submitReview({
          reviewerId: new ObjectId().toString(),
          reflectionId,
          scores: scores(9),
          helpful: false,
        }),
      ),
    );

    const accepted = results.filter(r => r.status === 'fulfilled').length;
    expect(accepted).toBe(5);

    const doc = await db
      .collection('reflections')
      .findOne({_id: new ObjectId(reflectionId)});
    expect(doc?.reviewCount).toBe(5);
    // scoreSum must equal exactly the 5 accepted reviews, no over-counting.
    expect(doc?.scoreSum).toBe(9 * 5);
  });

  it('reveals the average only after quota and threshold are both met', async () => {
    const item = await makeItem({
      requiredReviewsToUnlock: 2,
      minReviewsToReveal: 2,
    });
    const author = new ObjectId().toString();
    await submit(author, item, 9);

    // Two peers review the author.
    const peers = [new ObjectId().toString(), new ObjectId().toString()];
    const authorRef = await db
      .collection('reflections')
      .findOne({userId: new ObjectId(author)});
    for (const p of peers) {
      await service.submitReview({
        reviewerId: p,
        reflectionId: authorRef!._id.toString(),
        scores: scores(6),
        helpful: true,
      });
    }

    // Still locked: the author has completed 0 of their own 2 reviews.
    let mine = await service.getMyReflection({userId: author, itemId: item});
    expect(mine?.averageScore).toBeNull();
    expect(mine?.lockedReason).toBe('REVIEWS_PENDING');

    // Author reviews two peers to satisfy reciprocity.
    for (let i = 0; i < 2; i++) {
      const {reflectionId} = await submit(new ObjectId().toString(), item);
      await service.submitReview({
        reviewerId: author,
        reflectionId,
        scores: scores(5),
        helpful: false,
      });
    }

    mine = await service.getMyReflection({userId: author, itemId: item});
    expect(mine?.lockedReason).toBeUndefined();
    expect(mine?.averageScore).toBe(6); // both peers scored 6
    expect(mine?.helpfulCount).toBe(2);
    expect(mine?.confidence).toBe(9);
  });

  it('builds the instructor view with names, gap and provisional flag', async () => {
    const item = await makeItem({minReviewsToReveal: 3});
    const author = new ObjectId().toString();
    await db.collection('users').insertOne({
      _id: new ObjectId(author),
      firstName: 'Asha',
      lastName: 'Rao',
      email: 'asha@example.com',
    });
    const authorRef = await submit(author, item, 9);

    // Two reviews — below the reveal threshold of 3, so provisional.
    for (let i = 0; i < 2; i++) {
      await service.submitReview({
        reviewerId: new ObjectId().toString(),
        reflectionId: authorRef.reflectionId,
        scores: scores(4),
        helpful: false,
      });
    }

    const rows = await service.listForInstructor({
      courseVersionId: VERSION,
      itemId: item,
      limit: 50,
    });
    const row = rows.find(r => r.userId === author)!;

    expect(row.studentName).toBe('Asha Rao');
    expect(row.studentEmail).toBe('asha@example.com');
    expect(row.averageScore).toBe(4); // instructor sees it even when provisional
    expect(row.isProvisional).toBe(true);
    expect(row.confidenceGap).toBe(5); // self 9 − peer 4
    expect(row.reviewsReceived).toBe(2);
  });


  it('caps a reviewer at the quota the instructor set', async () => {
    // requiredReviewsToUnlock = 2: a student may review exactly two peers.
    const item = await makeItem({requiredReviewsToUnlock: 2, maxReviewsPerReflection: 10});
    const reviewer = new ObjectId().toString();

    // Three other students each submit a reflection.
    const targets = [];
    for (let i = 0; i < 3; i++) {
      targets.push((await submit(new ObjectId().toString(), item)).reflectionId);
    }

    // First two reviews are accepted.
    await service.submitReview({reviewerId: reviewer, reflectionId: targets[0], scores: scores(6), helpful: false});
    await service.submitReview({reviewerId: reviewer, reflectionId: targets[1], scores: scores(6), helpful: false});

    // The queue now offers nothing more to this reviewer.
    const next = await service.getNextForReview({userId: reviewer, itemId: item});
    expect(next).toBeNull();

    // And a third review is refused outright.
    await expect(
      service.submitReview({reviewerId: reviewer, reflectionId: targets[2], scores: scores(6), helpful: false}),
    ).rejects.toThrow(/completed all the reviews/i);
  });

  it('aggregates version stats correctly', async () => {
    const item = await makeItem({minReviewsToReveal: 2});
    // Two reflections, one scored above threshold, one below.
    const r1 = await submit(new ObjectId().toString(), item, 8);
    const r2 = await submit(new ObjectId().toString(), item, 4);

    for (let i = 0; i < 2; i++) {
      await service.submitReview({
        reviewerId: new ObjectId().toString(),
        reflectionId: r1.reflectionId,
        scores: scores(7),
        helpful: false,
      });
    }
    await service.submitReview({
      reviewerId: new ObjectId().toString(),
      reflectionId: r2.reflectionId,
      scores: scores(3),
      helpful: false,
    });

    const stats = await service.getInstructorStats({
      courseVersionId: VERSION,
      itemId: item,
    });

    expect(stats.reflectionCount).toBe(2);
    expect(stats.reviewCount).toBe(3);
    expect(stats.scoredCount).toBe(1); // only r1 reached 2 reviews
    expect(stats.averageScore).toBe(7); // only the scored one counts
    expect(stats.averageConfidence).toBe(6); // (8 + 4) / 2
  });
});
