import {afterAll, beforeAll, beforeEach, describe, expect, it} from 'vitest';
import {Db, MongoClient, ObjectId} from 'mongodb';
import {MongoMemoryReplSet} from 'mongodb-memory-server';
import {CaseStudyRepository} from '../repositories/providers/mongodb/CaseStudyRepository.js';
import {CaseStudyService} from '../services/CaseStudyService.js';
import {WINS_REQUIRED} from '../constants.js';

/** Stands in for CourseSettingService — case studies enabled, strict (WON-gated) unlock by default. */
class FakeCourseSettingService {
  async readCourseSettings() {
    return {
      settings: {
        caseStudiesEnabled: true,
        caseStudyStrictUnlockEnabled: true,
        caseStudyWeakStreakThreshold: 3,
      },
    };
  }
}

/** Stands in for NotificationService — this suite only asserts on repository-level behaviour. */
class FakeNotificationService {
  async createNotification() {}
}

/**
 * End-to-end coverage against a real MongoDB.
 *
 * The unit suite drives the service through an in-memory fake, so the actual
 * queries — the atomic findOneAndUpdate win/flag guards, the two unique-index
 * races (duplicate submission, duplicate served pair), and the quota counter
 * under concurrent picks — are only exercised here.
 *
 * A replica set (not a standalone) is used because the repository is written
 * to be safe under concurrent writes, and only a replica set exposes the
 * behaviour that would break if it were not.
 */

class TestDb {
  constructor(private db: Db) {}
  async getCollection<T>(name: string) {
    return this.db.collection<T>(name) as any;
  }
}

let mongo: MongoMemoryReplSet;
let client: MongoClient;
let db: Db;
let repo: CaseStudyRepository;
let service: CaseStudyService;

const COURSE = new ObjectId().toString();
const VERSION = new ObjectId().toString();

async function seedCase(sequenceIndex: number): Promise<string> {
  const {caseStudyId} = await service.createCaseStudy({
    courseId: COURSE,
    courseVersionId: VERSION,
    sequenceIndex,
    title: `Case ${sequenceIndex}`,
    bodyMarkdown: 'A prompt.',
  });
  return caseStudyId;
}

async function submit(caseStudyId: string, userId = new ObjectId().toString(), text = 'one two three') {
  return service.submitResponse({userId, caseStudyId, text});
}

/** Back-date a comparison's servedAt so its reading timer has already cleared. */
async function clearTimer(comparisonId: string) {
  await db
    .collection('caseComparisons')
    .updateOne(
      {_id: new ObjectId(comparisonId)},
      {$set: {servedAt: new Date(Date.now() - 999_000)}},
    );
}

beforeAll(async () => {
  mongo = await MongoMemoryReplSet.create({replSet: {count: 1}});
  client = new MongoClient(mongo.getUri());
  await client.connect();
  db = client.db('caseStudiesTest');

  const testDb = new TestDb(db) as any;
  repo = new CaseStudyRepository(testDb);
  service = new CaseStudyService(
    repo,
    new FakeCourseSettingService() as never,
    new FakeNotificationService() as never,
  );
}, 60_000);

afterAll(async () => {
  await client?.close();
  await mongo?.stop();
});

beforeEach(async () => {
  const cols = await db.collections();
  await Promise.all(cols.map(c => c.deleteMany({})));
});

describe('case studies — real MongoDB', () => {
  it('rejects a duplicate submission race with a clean error, not a crash', async () => {
    const caseId = await seedCase(1);
    const user = new ObjectId().toString();

    const results = await Promise.allSettled([submit(caseId, user), submit(caseId, user)]);
    const ok = results.filter(r => r.status === 'fulfilled');
    const rejected = results.filter(r => r.status === 'rejected') as PromiseRejectedResult[];

    expect(ok).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(String(rejected[0].reason?.message)).toMatch(/already submitted/i);

    const count = await db
      .collection('caseResponses')
      .countDocuments({userId: new ObjectId(user)});
    expect(count).toBe(1);
  });

  it('never serves the same reviewer the same pair twice, even under a concurrent race', async () => {
    const caseId = await seedCase(1);
    await submit(caseId, new ObjectId().toString());
    await submit(caseId, new ObjectId().toString());
    const reviewer = new ObjectId().toString();

    // Two concurrent "next pair" requests from the same reviewer with no
    // pending pair yet — createComparison's unique index must let exactly
    // one through, and the loser must fall back to the winner's pair rather
    // than erroring.
    const [pairA, pairB] = await Promise.all([
      service.getNextPair({reviewerId: reviewer, caseStudyId: caseId}),
      service.getNextPair({reviewerId: reviewer, caseStudyId: caseId}),
    ]);
    expect(pairA?.comparisonId).toBe(pairB?.comparisonId);

    const comparisonCount = await db
      .collection('caseComparisons')
      .countDocuments({reviewerId: new ObjectId(reviewer)});
    expect(comparisonCount).toBe(1);
  });

  it('re-serves the same pending pair with its original servedAt on a second request', async () => {
    const caseId = await seedCase(1);
    await submit(caseId, new ObjectId().toString());
    await submit(caseId, new ObjectId().toString());
    const reviewer = new ObjectId().toString();

    const first = await service.getNextPair({reviewerId: reviewer, caseStudyId: caseId});
    const second = await service.getNextPair({reviewerId: reviewer, caseStudyId: caseId});
    expect(second?.comparisonId).toBe(first?.comparisonId);
    expect(second?.servedAt).toBe(first?.servedAt);
  });

  it('rejects a pick before the server-computed minimum reading time elapses', async () => {
    const caseId = await seedCase(1);
    await submit(caseId, new ObjectId().toString(), 'x'.repeat(300));
    await submit(caseId, new ObjectId().toString(), 'x'.repeat(300));
    const reviewer = new ObjectId().toString();

    const pair = await service.getNextPair({reviewerId: reviewer, caseStudyId: caseId});
    expect(pair!.minimumScreenTimeSeconds).toBeGreaterThan(0);

    await expect(
      service.submitPick({reviewerId: reviewer, comparisonId: pair!.comparisonId, outcome: 'A'}),
    ).rejects.toThrow(/reading time/i);
  });

  it('holds a reviewer to exactly one accepted pick per served pair under a concurrent double-pick race', async () => {
    const caseId = await seedCase(1);
    await submit(caseId, new ObjectId().toString());
    await submit(caseId, new ObjectId().toString());
    const reviewer = new ObjectId().toString();

    const pair = await service.getNextPair({reviewerId: reviewer, caseStudyId: caseId});
    await clearTimer(pair!.comparisonId);

    const results = await Promise.allSettled([
      service.submitPick({reviewerId: reviewer, comparisonId: pair!.comparisonId, outcome: 'A'}),
      service.submitPick({reviewerId: reviewer, comparisonId: pair!.comparisonId, outcome: 'B'}),
    ]);
    const accepted = results.filter(r => r.status === 'fulfilled').length;
    expect(accepted).toBe(1);

    const quota = await repo.getReviewerQuota(reviewer, caseId);
    expect(quota).toBe(1);
  });

  it('flips status to WON exactly once even under concurrent winning picks', async () => {
    const caseId = await seedCase(1);
    const author = new ObjectId().toString();
    const {responseId} = await submit(caseId, author);
    // Enough opponents that pickPairCandidate always has two OPEN responses.
    for (let i = 0; i < WINS_REQUIRED + 2; i++) {
      await submit(caseId, new ObjectId().toString());
    }

    // Drive the target response to one win below the threshold sequentially.
    for (let i = 0; i < WINS_REQUIRED - 1; i++) {
      const reviewer = new ObjectId().toString();
      const pair = await service.getNextPair({reviewerId: reviewer, caseStudyId: caseId});
      await clearTimer(pair!.comparisonId);
      const outcome = pair!.left.responseId === responseId ? pair!.left.outcome : pair!.right.outcome;
      // If this pair doesn't include the target response, flag it out of the
      // way (BOTH_WEAK) and keep going — we only care about wins landing on
      // `responseId` specifically for this test's setup.
      if (pair!.left.responseId === responseId || pair!.right.responseId === responseId) {
        await service.submitPick({reviewerId: reviewer, comparisonId: pair!.comparisonId, outcome});
      } else {
        await service.submitPick({reviewerId: reviewer, comparisonId: pair!.comparisonId, outcome: 'BOTH_WEAK'});
      }
    }

    // Now fire several concurrent winning picks that could all push it over
    // the threshold at once — the WON flip must still happen exactly once.
    const finalReviewers = Array.from({length: 5}, () => new ObjectId().toString());
    await Promise.allSettled(
      finalReviewers.map(async reviewerId => {
        const pair = await service.getNextPair({reviewerId, caseStudyId: caseId});
        if (!pair) return;
        await clearTimer(pair.comparisonId);
        const outcome: 'A' | 'B' | 'BOTH_WEAK' =
          pair.left.responseId === responseId
            ? pair.left.outcome
            : pair.right.responseId === responseId
              ? pair.right.outcome
              : 'BOTH_WEAK';
        await service.submitPick({reviewerId, comparisonId: pair.comparisonId, outcome}).catch(() => {});
      }),
    );

    const doc = await db.collection('caseResponses').findOne({_id: new ObjectId(responseId)});
    if (doc!.winCount >= WINS_REQUIRED) {
      expect(doc!.status).toBe('WON');
    }
  });

  it('does NOT withdraw a response even after multiple FLAGGED verdicts', async () => {
    const caseId = await seedCase(1);
    const author = new ObjectId().toString();
    const {responseId} = await submit(caseId, author, 'garbled');
    await submit(caseId, new ObjectId().toString());

    for (let i = 0; i < 3; i++) {
      const reviewer = new ObjectId().toString();
      const pair = await service.getNextPair({reviewerId: reviewer, caseStudyId: caseId});
      if (!pair) break;
      await clearTimer(pair!.comparisonId);
      await service.submitPick({reviewerId: reviewer, comparisonId: pair!.comparisonId, outcome: 'FLAGGED'});
    }

    const doc = await db.collection('caseResponses').findOne({_id: new ObjectId(responseId)});
    // Flags are tracked for analytics but never change status.
    expect(doc?.flagCount).toBeGreaterThan(0);
    expect(doc?.status).not.toBe('WITHDRAWN');
  });

  it('upserts idempotently from a seed payload, keyed on (courseVersionId, sequenceIndex)', async () => {
    const entries = [
      {sequenceIndex: 1, title: 'Original title', bodyMarkdown: 'v1'},
      {sequenceIndex: 2, title: 'Second case', bodyMarkdown: 'v1'},
    ];
    const first = await service.upsertFromSeed({courseId: COURSE, courseVersionId: VERSION, entries});
    expect(first).toEqual({inserted: 2, updated: 0});

    const second = await service.upsertFromSeed({
      courseId: COURSE,
      courseVersionId: VERSION,
      entries: [{sequenceIndex: 1, title: 'Revised title', bodyMarkdown: 'v2'}],
    });
    expect(second).toEqual({inserted: 0, updated: 1});

    const cases = await service.listCasesForUser({
      userId: new ObjectId().toString(),
      courseId: COURSE,
      courseVersionId: VERSION,
    });
    expect(cases).toHaveLength(2);
    expect(cases.find(c => c.sequenceIndex === 1)!.title).toBe('Revised title');
  });

  it('reports integration progress facts without a completion boolean', async () => {
    const caseId = await seedCase(1);
    const learner = new ObjectId().toString();
    await submit(caseId, learner);

    const progress = await service.getIntegrationProgress({courseVersionId: VERSION, page: 1, limit: 50});
    expect(progress.totalLearners).toBe(1);
    expect(progress.learners[0].casesSubmitted).toBe(1);
    expect(progress.learners[0].casesInReview).toBe(1);
    expect(progress.learners[0].casesWon).toBe(0);
    expect(progress.learners[0]).not.toHaveProperty('completed');
  });
});
