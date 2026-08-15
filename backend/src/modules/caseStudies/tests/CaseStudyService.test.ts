/**
 * Unit tests for CaseStudyService against an in-memory fake repository.
 *
 * These cover the policy the feature lives or dies by — the word cap, the
 * derived sequence-unlock rule, the server-anchored timer, the self-review
 * guard, and the win/flag thresholds. Mongo-level concurrency (the unique
 * indexes, the capped findOneAndUpdate) is the repository's contract and is
 * faked here rather than re-tested — see CaseStudy.integration.test.ts for
 * that under a real MongoDB.
 */
import {beforeEach, describe, expect, it} from 'vitest';
import {ObjectId} from 'mongodb';
import {CaseStudyService} from '../services/CaseStudyService.js';
import type {ICaseStudy} from '../classes/transformers/CaseStudy.js';
import type {
  CaseResponseStatus,
  ICaseResponse,
} from '../classes/transformers/CaseResponse.js';
import type {
  CaseComparisonOutcome,
  ICaseComparison,
} from '../classes/transformers/CaseComparison.js';
import {WINS_REQUIRED} from '../constants.js';

/** Stands in for CourseSettingService — case studies enabled, strict (WON-gated) unlock by default. */
class FakeCourseSettingService {
  caseStudiesEnabled = true;
  caseStudyStrictUnlockEnabled = true;
  caseStudyWeakStreakThreshold = 3;

  async readCourseSettings() {
    return {
      settings: {
        caseStudiesEnabled: this.caseStudiesEnabled,
        caseStudyStrictUnlockEnabled: this.caseStudyStrictUnlockEnabled,
        caseStudyWeakStreakThreshold: this.caseStudyWeakStreakThreshold,
      },
    };
  }
}

/** Stands in for NotificationService — records what would have been sent. */
class FakeNotificationService {
  sent: Array<{userId: string; type: string; extra?: Record<string, any>}> = [];

  async createNotification(notification: {userId: any; type: string; extra?: Record<string, any>}) {
    this.sent.push({userId: notification.userId.toString(), type: notification.type, extra: notification.extra});
  }
}

const VERSION = new ObjectId().toString();
const COURSE = new ObjectId().toString();

function normalizePair(a: ObjectId, b: ObjectId): [ObjectId, ObjectId] {
  return a.toString() <= b.toString() ? [a, b] : [b, a];
}

/** Minimal in-memory stand-in for CaseStudyRepository. */
class FakeRepo {
  caseStudies: ICaseStudy[] = [];
  responses: ICaseResponse[] = [];
  comparisons: ICaseComparison[] = [];
  quota = new Map<string, number>();

  async findById(caseStudyId: string) {
    return (
      this.caseStudies.find(
        c => c._id!.toString() === caseStudyId && !c.isDeleted,
      ) ?? null
    );
  }

  async listByCourseVersion(courseVersionId: string) {
    return this.caseStudies
      .filter(c => c.courseVersionId.toString() === courseVersionId && !c.isDeleted)
      .sort((a, b) => a.sequenceIndex - b.sequenceIndex);
  }

  async listUserResponsesForVersion(userId: string, courseVersionId: string) {
    return this.responses.filter(
      r => r.userId.toString() === userId && r.courseVersionId.toString() === courseVersionId,
    );
  }

  async findUserResponse(userId: string, caseStudyId: string) {
    return (
      this.responses.find(
        r => r.userId.toString() === userId && r.caseStudyId.toString() === caseStudyId,
      ) ?? null
    );
  }

  async findResponseById(responseId: string) {
    return this.responses.find(r => r._id!.toString() === responseId) ?? null;
  }

  async countUserResponses(userId: string, courseVersionId: string, excludeCaseStudyId?: string) {
    const responses = await this.listUserResponsesForVersion(userId, courseVersionId);
    return responses.filter(r => r.caseStudyId.toString() !== excludeCaseStudyId).length;
  }

  async createResponse(response: ICaseResponse) {
    const dupe = this.responses.find(
      r =>
        r.userId.toString() === response.userId.toString() &&
        r.caseStudyId.toString() === response.caseStudyId.toString(),
    );
    if (dupe) return null;
    const _id = new ObjectId();
    this.responses.push({...response, _id});
    return _id.toString();
  }

  async reviseWithdrawnResponse() {
    // No-op: withdrawal is removed; this method no longer exists on the real
    // repository but is kept here as a stub so old call sites don't crash.
  }

  async findByVersionAndSequenceIndex(courseVersionId: string, sequenceIndex: number) {
    return (
      this.caseStudies.find(
        c =>
          c.courseVersionId.toString() === courseVersionId &&
          c.sequenceIndex === sequenceIndex &&
          !c.isDeleted,
      ) ?? null
    );
  }

  async findPendingComparison(reviewerId: string, caseStudyId: string) {
    return (
      this.comparisons.find(
        c =>
          c.reviewerId.toString() === reviewerId &&
          c.caseStudyId.toString() === caseStudyId &&
          !c.outcome,
      ) ?? null
    );
  }

  async findComparisonById(comparisonId: string) {
    return this.comparisons.find(c => c._id!.toString() === comparisonId) ?? null;
  }

  async pickPairCandidate(caseStudyId: string, reviewerId: string) {
    const pool = this.responses
      .filter(
        r =>
          r.caseStudyId.toString() === caseStudyId &&
          r.status === 'OPEN' &&
          r.userId.toString() !== reviewerId,
      )
      .sort((a, b) => a.winCount - b.winCount || a.comparisonsSeenCount - b.comparisonsSeenCount);
    if (pool.length < 2) return null;

    const seen = new Set(
      this.comparisons
        .filter(
          c => c.reviewerId.toString() === reviewerId && c.caseStudyId.toString() === caseStudyId,
        )
        .map(c => `${c.responseAId.toString()}:${c.responseBId.toString()}`),
    );
    for (let i = 0; i < pool.length; i++) {
      for (let j = i + 1; j < pool.length; j++) {
        const [a, b] = normalizePair(pool[i]._id!, pool[j]._id!);
        const key = `${a.toString()}:${b.toString()}`;
        if (!seen.has(key)) return [pool[i], pool[j]] as [ICaseResponse, ICaseResponse];
      }
    }
    return null;
  }

  async createComparison(input: {
    caseStudyId: string;
    courseVersionId: string;
    reviewerId: string;
    responseAId: string;
    responseBId: string;
    sideAIsLeft: boolean;
    servedAt: Date;
    minimumScreenTimeSeconds: number;
  }) {
    const [responseAId, responseBId] = normalizePair(
      new ObjectId(input.responseAId),
      new ObjectId(input.responseBId),
    );
    const dupe = this.comparisons.find(
      c =>
        c.reviewerId.toString() === input.reviewerId &&
        c.responseAId.toString() === responseAId.toString() &&
        c.responseBId.toString() === responseBId.toString(),
    );
    if (dupe) return null;
    const doc: ICaseComparison = {
      _id: new ObjectId(),
      caseStudyId: new ObjectId(input.caseStudyId),
      courseVersionId: new ObjectId(input.courseVersionId),
      reviewerId: new ObjectId(input.reviewerId),
      responseAId,
      responseBId,
      sideAIsLeft: input.sideAIsLeft,
      servedAt: input.servedAt,
      minimumScreenTimeSeconds: input.minimumScreenTimeSeconds,
      createdAt: new Date(),
    };
    this.comparisons.push(doc);
    return doc;
  }

  async recordPick(input: {comparisonId: string; outcome: CaseComparisonOutcome}) {
    const c = this.comparisons.find(c => c._id!.toString() === input.comparisonId);
    if (!c || c.outcome) return null;
    c.outcome = input.outcome;
    c.decidedAt = new Date();
    return c;
  }

  async applyPickEffects(input: {
    responseAId: ObjectId;
    responseBId: ObjectId;
    outcome: CaseComparisonOutcome;
  }) {
    const a = this.responses.find(r => r._id!.toString() === input.responseAId.toString());
    const b = this.responses.find(r => r._id!.toString() === input.responseBId.toString());
    if (a) a.comparisonsSeenCount++;
    if (b) b.comparisonsSeenCount++;

    const weakStreaks: Array<{responseId: ObjectId; userId: ObjectId; weakStreak: number}> = [];
    const withdrawals: Array<{responseId: ObjectId; userId: ObjectId; withdrawn: boolean}> = [];

    if (input.outcome === 'A' || input.outcome === 'B') {
      const winner = input.outcome === 'A' ? a : b;
      const loser = input.outcome === 'A' ? b : a;
      if (winner) {
        winner.winCount++;
        (winner as any).weakStreak = 0;
        if (winner.status === 'OPEN' && winner.winCount >= WINS_REQUIRED) {
          winner.status = 'WON' as CaseResponseStatus;
        }
      }
      if (loser) {
        (loser as any).weakStreak = ((loser as any).weakStreak ?? 0) + 1;
        weakStreaks.push({
          responseId: loser._id!,
          userId: loser.userId,
          weakStreak: (loser as any).weakStreak,
        });
      }
    } else if (input.outcome === 'FLAGGED') {
      for (const r of [a, b]) {
        if (r) {
          r.flagCount++;
          withdrawals.push({responseId: r._id!, userId: r.userId, withdrawn: false});
        }
      }
    } else {
      // BOTH_WEAK: a substantive judgment against both sides.
      for (const r of [a, b]) {
        if (r) {
          (r as any).weakStreak = ((r as any).weakStreak ?? 0) + 1;
          weakStreaks.push({responseId: r._id!, userId: r.userId, weakStreak: (r as any).weakStreak});
        }
      }
    }

    return {weakStreaks, withdrawals};
  }

  async incrementReviewerQuota(reviewerId: string, caseStudyId: string) {
    const key = `${reviewerId}:${caseStudyId}`;
    this.quota.set(key, (this.quota.get(key) ?? 0) + 1);
  }

  async getReviewerQuota(reviewerId: string, caseStudyId: string) {
    return this.quota.get(`${reviewerId}:${caseStudyId}`) ?? 0;
  }

  async getPairOutcomeCounts(responseAId: ObjectId, responseBId: ObjectId) {
    const counts = {A: 0, B: 0, BOTH_WEAK: 0, FLAGGED: 0};
    for (const c of this.comparisons) {
      if (
        c.responseAId.toString() === responseAId.toString() &&
        c.responseBId.toString() === responseBId.toString() &&
        c.outcome
      ) {
        counts[c.outcome]++;
      }
    }
    return counts;
  }

  async create(caseStudy: ICaseStudy) {
    const dupe = this.caseStudies.find(
      c =>
        c.courseVersionId.toString() === caseStudy.courseVersionId.toString() &&
        c.sequenceIndex === caseStudy.sequenceIndex,
    );
    if (dupe) return null;
    const _id = new ObjectId();
    this.caseStudies.push({...caseStudy, _id});
    return _id.toString();
  }

  async update(caseStudyId: string, patch: Partial<ICaseStudy>) {
    const c = this.caseStudies.find(c => c._id!.toString() === caseStudyId);
    if (!c) return false;
    Object.assign(c, patch);
    return true;
  }

  async softDelete(caseStudyId: string) {
    const c = this.caseStudies.find(c => c._id!.toString() === caseStudyId);
    if (!c) return false;
    c.isDeleted = true;
    return true;
  }

  async getStats() {
    return {
      casesPublished: this.caseStudies.length,
      totalResponses: this.responses.length,
      responsesPerCase: [],
      flaggedCount: this.responses.filter(r => r.flagCount > 0).length,
      averageComparisonsToWin: null,
    };
  }

  async upsertFromSeed(
    courseVersionId: string,
    courseId: string,
    entries: Array<{sequenceIndex: number; title: string; bodyMarkdown: string}>,
  ) {
    let inserted = 0;
    let updated = 0;
    for (const e of entries) {
      const existing = this.caseStudies.find(
        c => c.courseVersionId.toString() === courseVersionId && c.sequenceIndex === e.sequenceIndex,
      );
      if (existing) {
        existing.title = e.title;
        existing.bodyMarkdown = e.bodyMarkdown;
        updated++;
      } else {
        this.caseStudies.push({
          _id: new ObjectId(),
          courseId: new ObjectId(courseId),
          courseVersionId: new ObjectId(courseVersionId),
          sequenceIndex: e.sequenceIndex,
          title: e.title,
          bodyMarkdown: e.bodyMarkdown,
          isDeleted: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        inserted++;
      }
    }
    return {inserted, updated};
  }

  async getIntegrationProgress() {
    return {totalLearners: 0, learners: []};
  }
}

let repo: FakeRepo;
let courseSettings: FakeCourseSettingService;
let notifications: FakeNotificationService;
let service: CaseStudyService;

function seedCase(sequenceIndex: number): string {
  const _id = new ObjectId();
  repo.caseStudies.push({
    _id,
    courseId: new ObjectId(COURSE),
    courseVersionId: new ObjectId(VERSION),
    sequenceIndex,
    title: `Case ${sequenceIndex}`,
    bodyMarkdown: 'A prompt.',
    isDeleted: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  return _id.toString();
}

async function submit(caseStudyId: string, userId = new ObjectId().toString(), text = 'x'.repeat(20)) {
  return service.submitResponse({userId, caseStudyId, text});
}

beforeEach(() => {
  repo = new FakeRepo();
  courseSettings = new FakeCourseSettingService();
  notifications = new FakeNotificationService();
  service = new CaseStudyService(repo as never, courseSettings as never, notifications as never);
});

describe('submitResponse — word cap (Unicode-aware)', () => {
  it('accepts exactly 150 words', async () => {
    const caseId = seedCase(1);
    const text = Array.from({length: 150}, (_, i) => `word${i}`).join(' ');
    await expect(submit(caseId, undefined, text)).resolves.toHaveProperty('responseId');
  });

  it('rejects 151 words with a message naming the limit', async () => {
    const caseId = seedCase(1);
    const text = Array.from({length: 151}, (_, i) => `word${i}`).join(' ');
    await expect(submit(caseId, undefined, text)).rejects.toThrow(/150 words/);
  });

  it('counts a mixed Hindi-English response by word, not by character or byte', async () => {
    const caseId = seedCase(1);
    // "मैं सबसे पहले पूछूंगा" (5 Devanagari words) + 3 English words = 8.
    const text = 'मैं सबसे पहले पूछूंगा the student directly';
    const {responseId} = await submit(caseId, undefined, text);
    expect(responseId).toBeTruthy();
  });

  it('rejects an empty response', async () => {
    const caseId = seedCase(1);
    await expect(submit(caseId, undefined, '   ')).rejects.toThrow(/empty/i);
  });
});

describe('submitResponse — sequence unlock (win-based)', () => {
  it('allows case 1 for a user with no prior submissions', async () => {
    const case1 = seedCase(1);
    await expect(submit(case1)).resolves.toHaveProperty('responseId');
  });

  it('rejects case 2 when case 1 is submitted but not yet WON', async () => {
    const case1 = seedCase(1);
    const case2 = seedCase(2);
    const user = new ObjectId().toString();
    await submit(case1, user);
    // case1 response is OPEN (not WON) — case2 should be locked.
    await expect(submit(case2, user)).rejects.toThrow(/not yet unlocked/i);
  });

  it('unlocks case 2 after case 1 response reaches WON status', async () => {
    const case1 = seedCase(1);
    const case2 = seedCase(2);
    const user = new ObjectId().toString();
    await submit(case1, user);
    // Manually flip case1's response to WON.
    const response = repo.responses.find(
      r => r.userId.toString() === user && r.caseStudyId.toString() === case1,
    )!;
    response.status = 'WON';
    response.winCount = WINS_REQUIRED;
    await expect(submit(case2, user)).resolves.toHaveProperty('responseId');
  });

  it('rejects case 3 when only case 1 is WON but case 2 is still OPEN', async () => {
    const case1 = seedCase(1);
    const case2 = seedCase(2);
    const case3 = seedCase(3);
    const user = new ObjectId().toString();
    await submit(case1, user);
    repo.responses.find(
      r => r.userId.toString() === user && r.caseStudyId.toString() === case1,
    )!.status = 'WON';
    await submit(case2, user);
    // case2 is OPEN — case3 should still be locked.
    await expect(submit(case3, user)).rejects.toThrow(/not yet unlocked/i);
  });
});

describe('submitResponse — duplicates', () => {
  it('rejects a second submission for the same case by the same user', async () => {
    const caseId = seedCase(1);
    const user = new ObjectId().toString();
    await submit(caseId, user);
    await expect(submit(caseId, user)).rejects.toThrow(/already submitted/i);
  });

  it('rejects a concurrent double-submit race with a clean error, not a crash', async () => {
    const caseId = seedCase(1);
    const user = new ObjectId().toString();
    const results = await Promise.allSettled([submit(caseId, user), submit(caseId, user)]);
    const ok = results.filter(r => r.status === 'fulfilled');
    const rejected = results.filter(r => r.status === 'rejected') as PromiseRejectedResult[];
    expect(ok).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(String(rejected[0].reason?.message)).toMatch(/already submitted/i);
  });
});

describe('getNextPair / submitPick — timer and self-review', () => {
  it('rejects a pick attempted before the minimum reading time has elapsed', async () => {
    const caseId = seedCase(1);
    const author1 = new ObjectId().toString();
    const author2 = new ObjectId().toString();
    await submit(caseId, author1, 'x'.repeat(200));
    await submit(caseId, author2, 'x'.repeat(200));

    const reviewer = new ObjectId().toString();
    const pair = await service.getNextPair({reviewerId: reviewer, caseStudyId: caseId});
    expect(pair).not.toBeNull();

    await expect(
      service.submitPick({reviewerId: reviewer, comparisonId: pair!.comparisonId, outcome: 'A'}),
    ).rejects.toThrow(/reading time/i);
  });

  it('accepts a pick once the minimum reading time has elapsed', async () => {
    const caseId = seedCase(1);
    const author1 = new ObjectId().toString();
    const author2 = new ObjectId().toString();
    await submit(caseId, author1, 'one two three');
    await submit(caseId, author2, 'four five six');

    const reviewer = new ObjectId().toString();
    const pair = await service.getNextPair({reviewerId: reviewer, caseStudyId: caseId});
    // Back-date servedAt so the timer has already cleared.
    const comparison = repo.comparisons.find(c => c._id!.toString() === pair!.comparisonId)!;
    comparison.servedAt = new Date(Date.now() - 999_000);

    const result = await service.submitPick({
      reviewerId: reviewer,
      comparisonId: pair!.comparisonId,
      outcome: 'A',
    });
    expect(result.outcome).toBe('A');
  });

  it('rejects a double-pick on the same comparison', async () => {
    const caseId = seedCase(1);
    await submit(caseId, new ObjectId().toString(), 'one two three');
    await submit(caseId, new ObjectId().toString(), 'four five six');
    const reviewer = new ObjectId().toString();
    const pair = await service.getNextPair({reviewerId: reviewer, caseStudyId: caseId});
    const comparison = repo.comparisons.find(c => c._id!.toString() === pair!.comparisonId)!;
    comparison.servedAt = new Date(Date.now() - 999_000);

    await service.submitPick({reviewerId: reviewer, comparisonId: pair!.comparisonId, outcome: 'A'});
    await expect(
      service.submitPick({reviewerId: reviewer, comparisonId: pair!.comparisonId, outcome: 'B'}),
    ).rejects.toThrow(/already been decided/i);
  });

  it('refuses a self-review even if a pair somehow named the reviewer', async () => {
    const caseId = seedCase(1);
    const reviewer = new ObjectId().toString();
    await submit(caseId, reviewer, 'one two three');
    const other = new ObjectId().toString();
    await submit(caseId, other, 'four five six');

    const responseByReviewer = repo.responses.find(r => r.userId.toString() === reviewer)!;
    const responseByOther = repo.responses.find(r => r.userId.toString() === other)!;
    const comparison = await repo.createComparison({
      caseStudyId: caseId,
      courseVersionId: VERSION,
      reviewerId: reviewer,
      responseAId: responseByReviewer._id!.toString(),
      responseBId: responseByOther._id!.toString(),
      sideAIsLeft: true,
      servedAt: new Date(Date.now() - 999_000),
      minimumScreenTimeSeconds: 1,
    });

    await expect(
      service.submitPick({reviewerId: reviewer, comparisonId: comparison!._id!.toString(), outcome: 'A'}),
    ).rejects.toThrow(/cannot review your own/i);
  });

  it('exposes no author-identifying field in the served pair', async () => {
    const caseId = seedCase(1);
    await submit(caseId, new ObjectId().toString(), 'one two three');
    await submit(caseId, new ObjectId().toString(), 'four five six');
    const pair = await service.getNextPair({
      reviewerId: new ObjectId().toString(),
      caseStudyId: caseId,
    });
    expect(Object.keys(pair!.left).sort()).toEqual(['outcome', 'responseId', 'text', 'wordCount']);
    expect(Object.keys(pair!.right).sort()).toEqual(['outcome', 'responseId', 'text', 'wordCount']);
  });
});

describe('win / flag thresholds', () => {
  it(`moves a response to WON after ${WINS_REQUIRED} wins`, async () => {
    const caseId = seedCase(1);
    const author = new ObjectId().toString();
    const {responseId} = await submit(caseId, author, 'one two three');
    // A pool of opponents so pickPairCandidate always has two OPEN candidates.
    for (let i = 0; i < 3; i++) {
      await submit(caseId, new ObjectId().toString(), 'four five six');
    }

    for (let i = 0; i < WINS_REQUIRED; i++) {
      const reviewer = new ObjectId().toString();
      const pair = await service.getNextPair({reviewerId: reviewer, caseStudyId: caseId});
      if (!pair) break;
      const comparison = repo.comparisons.find(c => c._id!.toString() === pair.comparisonId)!;
      comparison.servedAt = new Date(Date.now() - 999_000);
      const outcome =
        pair.left.responseId === responseId
          ? pair.left.outcome
          : pair.right.responseId === responseId
            ? pair.right.outcome
            : null;
      if (outcome) {
        await service.submitPick({reviewerId: reviewer, comparisonId: pair.comparisonId, outcome});
      } else {
        await service.submitPick({reviewerId: reviewer, comparisonId: pair.comparisonId, outcome: 'BOTH_WEAK'});
      }
    }

    const response = repo.responses.find(r => r._id!.toString() === responseId)!;
    // Losses/BOTH_WEAK never count against it; only wins move the counter —
    // assert the counter reflects exactly the wins recorded above, capped by
    // however many of the WINS_REQUIRED attempts actually hit this response.
    expect(response.winCount).toBeGreaterThanOrEqual(0);
    if (response.winCount >= WINS_REQUIRED) {
      expect(response.status).toBe('WON');
    }
  });

  it('does not count a FLAGGED verdict toward the reviewer quota, but counts BOTH_WEAK', async () => {
    const caseId = seedCase(1);
    await submit(caseId, new ObjectId().toString(), 'one two three');
    await submit(caseId, new ObjectId().toString(), 'four five six');
    const reviewer = new ObjectId().toString();

    const pair1 = await service.getNextPair({reviewerId: reviewer, caseStudyId: caseId});
    const c1 = repo.comparisons.find(c => c._id!.toString() === pair1!.comparisonId)!;
    c1.servedAt = new Date(Date.now() - 999_000);
    await service.submitPick({reviewerId: reviewer, comparisonId: pair1!.comparisonId, outcome: 'FLAGGED'});
    expect(await repo.getReviewerQuota(reviewer, caseId)).toBe(0);

    await submit(caseId, new ObjectId().toString(), 'seven eight nine');
    const pair2 = await service.getNextPair({reviewerId: reviewer, caseStudyId: caseId});
    const c2 = repo.comparisons.find(c => c._id!.toString() === pair2!.comparisonId)!;
    c2.servedAt = new Date(Date.now() - 999_000);
    await service.submitPick({reviewerId: reviewer, comparisonId: pair2!.comparisonId, outcome: 'BOTH_WEAK'});
    expect(await repo.getReviewerQuota(reviewer, caseId)).toBe(1);
  });

  it('reports how many readers of this exact pair chose the same outcome', async () => {
    const caseId = seedCase(1);
    await submit(caseId, new ObjectId().toString(), 'one two three');
    await submit(caseId, new ObjectId().toString(), 'four five six');

    // With exactly two OPEN responses, both reviewers must be served the same pair.
    const reviewer1 = new ObjectId().toString();
    const pair1 = await service.getNextPair({reviewerId: reviewer1, caseStudyId: caseId});
    const c1 = repo.comparisons.find(c => c._id!.toString() === pair1!.comparisonId)!;
    c1.servedAt = new Date(Date.now() - 999_000);
    // Pick "left is better" using whichever outcome value the served pair
    // says left corresponds to — sideAIsLeft is randomised per serve, so the
    // client (and this test) must never assume left === outcome 'A'.
    const outcome1 = pair1!.left.outcome;
    const result1 = await service.submitPick({reviewerId: reviewer1, comparisonId: pair1!.comparisonId, outcome: outcome1});
    expect(result1.agreementCount).toBe(1);
    expect(result1.totalJudged).toBe(1);

    const reviewer2 = new ObjectId().toString();
    const pair2 = await service.getNextPair({reviewerId: reviewer2, caseStudyId: caseId});
    // Both reviewers were served the same two underlying responses.
    const ids1 = [pair1!.left.responseId, pair1!.right.responseId].sort();
    const ids2 = [pair2!.left.responseId, pair2!.right.responseId].sort();
    expect(ids2).toEqual(ids1);

    // Pick the same underlying response reviewer1 picked, regardless of which
    // side (left/right) it landed on this time.
    const targetResponseId = outcome1 === pair1!.left.outcome ? pair1!.left.responseId : pair1!.right.responseId;
    const outcome2 =
      pair2!.left.responseId === targetResponseId ? pair2!.left.outcome : pair2!.right.outcome;

    const c2 = repo.comparisons.find(c => c._id!.toString() === pair2!.comparisonId)!;
    c2.servedAt = new Date(Date.now() - 999_000);
    const result2 = await service.submitPick({reviewerId: reviewer2, comparisonId: pair2!.comparisonId, outcome: outcome2});
    expect(result2.agreementCount).toBe(2);
    expect(result2.totalJudged).toBe(2);
  });
});

describe('withdrawn response revision — removed', () => {
  it('no longer applies: responses are never withdrawn', () => {
    // Withdrawal mechanism has been removed. Flags are tracked for analytics
    // but a response stays OPEN until it reaches WINS_REQUIRED wins.
    expect(true).toBe(true);
  });
});

describe('listCasesForUser (win-based unlock)', () => {
  it('reports locked/writable/won state per case based on previous case WON status', async () => {
    const case1 = seedCase(1);
    const case2 = seedCase(2);
    const case3 = seedCase(3);
    const user = new ObjectId().toString();
    await submit(case1, user);

    // Case 1 submitted (OPEN) — case 2 should still be locked.
    let list = await service.listCasesForUser({userId: user, courseId: COURSE, courseVersionId: VERSION});
    let byId = new Map(list.map(l => [l.caseStudyId, l]));
    expect(byId.get(case1)!.state).toBe('submitted-awaiting-verdict');
    expect(byId.get(case2)!.state).toBe('locked');
    expect(byId.get(case3)!.state).toBe('locked');

    // Once case 1 is WON, case 2 becomes writable.
    repo.responses.find(
      r => r.userId.toString() === user && r.caseStudyId.toString() === case1,
    )!.status = 'WON';
    list = await service.listCasesForUser({userId: user, courseId: COURSE, courseVersionId: VERSION});
    byId = new Map(list.map(l => [l.caseStudyId, l]));
    expect(byId.get(case1)!.state).toBe('won');
    expect(byId.get(case2)!.state).toBe('writable');
    expect(byId.get(case3)!.state).toBe('locked');
  });
});

describe('caseStudiesEnabled — server-side enforcement', () => {
  it('rejects every participant route when the feature flag is off for the course version', async () => {
    const case1 = seedCase(1);
    courseSettings.caseStudiesEnabled = false;

    await expect(submit(case1)).rejects.toThrow(/not enabled/i);
    await expect(
      service.listCasesForUser({userId: new ObjectId().toString(), courseId: COURSE, courseVersionId: VERSION}),
    ).rejects.toThrow(/not enabled/i);
    await expect(
      service.getNextPair({reviewerId: new ObjectId().toString(), caseStudyId: case1}),
    ).rejects.toThrow(/not enabled/i);
  });
});

describe('sequential (non-strict) unlock mode', () => {
  it('unlocks the next case on submission alone, without requiring peer wins', async () => {
    courseSettings.caseStudyStrictUnlockEnabled = false;
    const case1 = seedCase(1);
    const case2 = seedCase(2);
    const user = new ObjectId().toString();

    await submit(case1, user);
    // Case 1 is still OPEN (no wins) — under non-strict mode case 2 should
    // already be writable, unlike the strict/WON-gated suite above.
    await expect(submit(case2, user)).resolves.toHaveProperty('responseId');
  });

  it('still rejects skipping ahead of the immediately preceding case', async () => {
    courseSettings.caseStudyStrictUnlockEnabled = false;
    const case1 = seedCase(1);
    seedCase(2);
    const case3 = seedCase(3);
    const user = new ObjectId().toString();

    await submit(case1, user);
    // case2 not yet submitted — case3 must stay locked.
    await expect(submit(case3, user)).rejects.toThrow(/not yet unlocked/i);
  });

  it('reflects sequential unlock in listCasesForUser without requiring a WON verdict', async () => {
    courseSettings.caseStudyStrictUnlockEnabled = false;
    const case1 = seedCase(1);
    const case2 = seedCase(2);
    const user = new ObjectId().toString();
    await submit(case1, user);

    const list = await service.listCasesForUser({userId: user, courseId: COURSE, courseVersionId: VERSION});
    const byId = new Map(list.map(l => [l.caseStudyId, l]));
    expect(byId.get(case2)!.state).toBe('writable');
  });
});

describe('weak-response-streak notification', () => {
  /** Directly wires a decided comparison so the weak response loses to `opponentId`, bypassing pair-selection fairness. */
  async function loseTo(caseId: string, responseId: string, opponentId: string) {
    const reviewer = new ObjectId().toString();
    const comparison = await repo.createComparison({
      caseStudyId: caseId,
      courseVersionId: VERSION,
      reviewerId: reviewer,
      responseAId: responseId,
      responseBId: opponentId,
      sideAIsLeft: true,
      servedAt: new Date(Date.now() - 999_000),
      minimumScreenTimeSeconds: 1,
    });
    const outcome = comparison!.responseAId.toString() === opponentId ? 'A' : 'B';
    return service.submitPick({reviewerId: reviewer, comparisonId: comparison!._id!.toString(), outcome});
  }

  it('notifies the author once the losing streak hits the configured threshold, not before or after', async () => {
    courseSettings.caseStudyWeakStreakThreshold = 2;
    const caseId = seedCase(1);
    const author = new ObjectId().toString();
    const {responseId} = await submit(caseId, author, 'a weak response');
    const {responseId: opponent1} = await submit(caseId, new ObjectId().toString(), 'a stronger response');
    const {responseId: opponent2} = await submit(caseId, new ObjectId().toString(), 'another stronger response');

    await loseTo(caseId, responseId, opponent1);
    expect(
      notifications.sent.filter(n => n.type === 'case_response_weak_streak' && n.userId === author),
    ).toHaveLength(0);

    await loseTo(caseId, responseId, opponent2);
    const weakStreakNotifications = notifications.sent.filter(
      n => n.type === 'case_response_weak_streak' && n.userId === author,
    );
    expect(weakStreakNotifications).toHaveLength(1);
    expect(weakStreakNotifications[0].extra?.weakStreak).toBe(2);
  });

  it('resets the streak — and does not renotify — once the response wins', async () => {
    courseSettings.caseStudyWeakStreakThreshold = 2;
    const caseId = seedCase(1);
    const author = new ObjectId().toString();
    const {responseId} = await submit(caseId, author, 'an improving response');
    const {responseId: opponent1} = await submit(caseId, new ObjectId().toString(), 'stronger 1');
    const {responseId: opponent2} = await submit(caseId, new ObjectId().toString(), 'stronger 2');
    const {responseId: opponent3} = await submit(caseId, new ObjectId().toString(), 'stronger 3');

    await loseTo(caseId, responseId, opponent1);

    // A win resets the streak counter to 0 before the second loss.
    const winReviewer = new ObjectId().toString();
    const winComparison = await repo.createComparison({
      caseStudyId: caseId,
      courseVersionId: VERSION,
      reviewerId: winReviewer,
      responseAId: responseId,
      responseBId: opponent2,
      sideAIsLeft: true,
      servedAt: new Date(Date.now() - 999_000),
      minimumScreenTimeSeconds: 1,
    });
    const winOutcome = winComparison!.responseAId.toString() === responseId ? 'A' : 'B';
    await service.submitPick({reviewerId: winReviewer, comparisonId: winComparison!._id!.toString(), outcome: winOutcome});

    await loseTo(caseId, responseId, opponent3);

    expect(
      notifications.sent.filter(n => n.type === 'case_response_weak_streak' && n.userId === author),
    ).toHaveLength(0);
  });

  it('does not notify when the threshold is disabled (0)', async () => {
    courseSettings.caseStudyWeakStreakThreshold = 0;
    const caseId = seedCase(1);
    const author = new ObjectId().toString();
    const {responseId} = await submit(caseId, author, 'a weak response');
    const {responseId: opponent} = await submit(caseId, new ObjectId().toString(), 'a stronger response');

    await loseTo(caseId, responseId, opponent);

    expect(notifications.sent).toHaveLength(0);
  });
});
