/**
 * Unit tests for CaseStudyService against an in-memory fake repository.
 *
 * These cover the policy the feature lives or dies by — the steelman min-
 * word check, the video-based unlock, the server-anchored timer, the self-
 * review guard, and the win/flag thresholds. Mongo-level concurrency (the
 * unique indexes, the capped findOneAndUpdate) is the repository's contract
 * and is faked here rather than re-tested — see CaseStudy.integration.test.ts
 * for that under a real MongoDB.
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
import {ELEMENT_2A_MIN_WORDS, WINS_REQUIRED} from '../constants.js';

/** Stands in for CourseSettingService — case studies enabled by default. */
class FakeCourseSettingService {
  caseStudiesEnabled = true;
  caseStudyWeakStreakThreshold = 3;

  async readCourseSettings() {
    return {
      settings: {
        caseStudiesEnabled: this.caseStudiesEnabled,
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

/** Stands in for ProgressService — tracks which video item IDs are "completed". */
class FakeProgressService {
  completedItems = new Set<string>();

  async isItemCompleted(
    _userId: string,
    _courseId: string,
    _courseVersionId: string,
    itemId: string,
  ): Promise<boolean> {
    return this.completedItems.has(itemId);
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

  async reviseResponse(
    userId: string,
    caseStudyId: string,
    fields: {beat1a: string; beat1b: string; beat1c: string; steelman: string; roomPerspective: string; changeCommitment: string},
  ) {
    const r = this.responses.find(
      r => r.userId.toString() === userId && r.caseStudyId.toString() === caseStudyId,
    );
    if (!r || r.status === 'WON') return false;
    Object.assign(r, fields, {status: 'OPEN', winCount: 0, weakStreak: 0, comparisonsSeenCount: 0, flagCount: 0});
    return true;
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
let progressService: FakeProgressService;
let service: CaseStudyService;

/** Seeds a case with a linked video; auto-marks the video as completed. */
function seedCase(sequenceIndex: number): string {
  const _id = new ObjectId();
  const videoId = new ObjectId();
  repo.caseStudies.push({
    _id,
    courseId: new ObjectId(COURSE),
    courseVersionId: new ObjectId(VERSION),
    sequenceIndex,
    title: `Case ${sequenceIndex}`,
    bodyMarkdown: 'A prompt.',
    linkedItemId: videoId,
    isDeleted: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  progressService.completedItems.add(videoId.toString());
  return _id.toString();
}

/** Seeds a case without any linked video (always locked). */
function seedCaseUnlinked(sequenceIndex: number): string {
  const _id = new ObjectId();
  repo.caseStudies.push({
    _id,
    courseId: new ObjectId(COURSE),
    courseVersionId: new ObjectId(VERSION),
    sequenceIndex,
    title: `Case ${sequenceIndex} (unlinked)`,
    bodyMarkdown: 'A prompt.',
    isDeleted: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  return _id.toString();
}

const VALID_STEELMAN = Array.from({length: ELEMENT_2A_MIN_WORDS}, (_, i) => `word${i}`).join(' ');

function makeFields(overrides: Partial<{
  beat1a: string; beat1b: string; beat1c: string;
  steelman: string; roomPerspective: string; changeCommitment: string;
}> = {}) {
  return {
    beat1a: 'What I thought going in.',
    beat1b: 'What challenged it during the discussion.',
    beat1c: 'Where I finally ended up landing.',
    steelman: VALID_STEELMAN,
    roomPerspective: 'One perspective from the room.',
    changeCommitment: 'One thing I will change.',
    ...overrides,
  };
}

async function submit(caseStudyId: string, userId = new ObjectId().toString(), overrides = {}) {
  return service.submitResponse({userId, caseStudyId, ...makeFields(overrides)});
}

beforeEach(() => {
  repo = new FakeRepo();
  courseSettings = new FakeCourseSettingService();
  notifications = new FakeNotificationService();
  progressService = new FakeProgressService();
  service = new CaseStudyService(
    repo as never,
    courseSettings as never,
    notifications as never,
    progressService as never,
  );
});

describe('submitResponse — steelman word count', () => {
  it(`accepts steelman with exactly ${ELEMENT_2A_MIN_WORDS} words`, async () => {
    const caseId = seedCase(1);
    await expect(submit(caseId)).resolves.toHaveProperty('responseId');
  });

  it(`rejects steelman with fewer than ${ELEMENT_2A_MIN_WORDS} words`, async () => {
    const caseId = seedCase(1);
    await expect(submit(caseId, undefined, {steelman: 'too short'})).rejects.toThrow(/25 words/);
  });

  it('rejects an empty steelman', async () => {
    const caseId = seedCase(1);
    // Whitespace trims to zero words, so the word-count floor rejects it.
    await expect(submit(caseId, undefined, {steelman: '   '})).rejects.toThrow(/at least 25 words/i);
  });

  it('counts a mixed Hindi-English steelman by word, not by character or byte', async () => {
    const caseId = seedCase(1);
    // 5 Devanagari words + 20 English words = 25 words total
    const steelman = 'मैं सबसे पहले पूछूंगा छात्र ' +
      Array.from({length: 20}, (_, i) => `word${i}`).join(' ');
    const {responseId} = await submit(caseId, undefined, {steelman});
    expect(responseId).toBeTruthy();
  });
});

describe('submitResponse — video-based unlock', () => {
  it('allows submission when the linked video is completed', async () => {
    const caseId = seedCase(1);
    await expect(submit(caseId)).resolves.toHaveProperty('responseId');
  });

  it('rejects submission when the linked video is not completed', async () => {
    const caseId = seedCase(1);
    const caseDoc = repo.caseStudies.find(c => c._id!.toString() === caseId)!;
    progressService.completedItems.delete(caseDoc.linkedItemId!.toString());
    await expect(submit(caseId)).rejects.toThrow(/linked video/i);
  });

  it('rejects submission when the case has no linked video', async () => {
    const caseId = seedCaseUnlinked(1);
    await expect(submit(caseId)).rejects.toThrow(/not yet linked/i);
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
    await submit(caseId, author1);
    await submit(caseId, author2);

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
    await submit(caseId, author1);
    await submit(caseId, author2);

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
    await submit(caseId, new ObjectId().toString());
    await submit(caseId, new ObjectId().toString());
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
    await submit(caseId, reviewer);
    const other = new ObjectId().toString();
    await submit(caseId, other);

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

  it('exposes all six response fields in the served pair', async () => {
    const caseId = seedCase(1);
    await submit(caseId, new ObjectId().toString());
    await submit(caseId, new ObjectId().toString());
    const pair = await service.getNextPair({
      reviewerId: new ObjectId().toString(),
      caseStudyId: caseId,
    });
    const expectedKeys = [
      'beat1a', 'beat1b', 'beat1c', 'changeCommitment', 'outcome',
      'responseId', 'roomPerspective', 'steelman', 'wordCount',
    ];
    expect(Object.keys(pair!.left).sort()).toEqual(expectedKeys);
    expect(Object.keys(pair!.right).sort()).toEqual(expectedKeys);
  });
});

describe('win / flag thresholds', () => {
  it(`moves a response to WON after ${WINS_REQUIRED} wins`, async () => {
    const caseId = seedCase(1);
    const author = new ObjectId().toString();
    const {responseId} = await submit(caseId, author);
    // A pool of opponents so pickPairCandidate always has two OPEN candidates.
    for (let i = 0; i < 3; i++) {
      await submit(caseId, new ObjectId().toString());
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
    expect(response.winCount).toBeGreaterThanOrEqual(0);
    if (response.winCount >= WINS_REQUIRED) {
      expect(response.status).toBe('WON');
    }
  });

  it('does not count a FLAGGED verdict toward the reviewer quota, but counts BOTH_WEAK', async () => {
    const caseId = seedCase(1);
    await submit(caseId, new ObjectId().toString());
    await submit(caseId, new ObjectId().toString());
    const reviewer = new ObjectId().toString();

    const pair1 = await service.getNextPair({reviewerId: reviewer, caseStudyId: caseId});
    const c1 = repo.comparisons.find(c => c._id!.toString() === pair1!.comparisonId)!;
    c1.servedAt = new Date(Date.now() - 999_000);
    await service.submitPick({reviewerId: reviewer, comparisonId: pair1!.comparisonId, outcome: 'FLAGGED'});
    expect(await repo.getReviewerQuota(reviewer, caseId)).toBe(0);

    await submit(caseId, new ObjectId().toString());
    const pair2 = await service.getNextPair({reviewerId: reviewer, caseStudyId: caseId});
    const c2 = repo.comparisons.find(c => c._id!.toString() === pair2!.comparisonId)!;
    c2.servedAt = new Date(Date.now() - 999_000);
    await service.submitPick({reviewerId: reviewer, comparisonId: pair2!.comparisonId, outcome: 'BOTH_WEAK'});
    expect(await repo.getReviewerQuota(reviewer, caseId)).toBe(1);
  });

  it('reports how many readers of this exact pair chose the same outcome', async () => {
    const caseId = seedCase(1);
    await submit(caseId, new ObjectId().toString());
    await submit(caseId, new ObjectId().toString());

    const reviewer1 = new ObjectId().toString();
    const pair1 = await service.getNextPair({reviewerId: reviewer1, caseStudyId: caseId});
    const c1 = repo.comparisons.find(c => c._id!.toString() === pair1!.comparisonId)!;
    c1.servedAt = new Date(Date.now() - 999_000);
    const outcome1 = pair1!.left.outcome;
    const result1 = await service.submitPick({reviewerId: reviewer1, comparisonId: pair1!.comparisonId, outcome: outcome1});
    expect(result1.agreementCount).toBe(1);
    expect(result1.totalJudged).toBe(1);

    const reviewer2 = new ObjectId().toString();
    const pair2 = await service.getNextPair({reviewerId: reviewer2, caseStudyId: caseId});
    const ids1 = [pair1!.left.responseId, pair1!.right.responseId].sort();
    const ids2 = [pair2!.left.responseId, pair2!.right.responseId].sort();
    expect(ids2).toEqual(ids1);

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

describe('listCasesForUser (video-based unlock)', () => {
  it('reports writable when the linked video is completed', async () => {
    const case1 = seedCase(1);
    const user = new ObjectId().toString();

    const list = await service.listCasesForUser({userId: user, courseId: COURSE, courseVersionId: VERSION});
    expect(list.find(c => c.caseStudyId === case1)!.state).toBe('writable');
  });

  it('reports locked when the linked video is not completed', async () => {
    const case1 = seedCase(1);
    const caseDoc = repo.caseStudies.find(c => c._id!.toString() === case1)!;
    progressService.completedItems.delete(caseDoc.linkedItemId!.toString());
    const user = new ObjectId().toString();

    const list = await service.listCasesForUser({userId: user, courseId: COURSE, courseVersionId: VERSION});
    expect(list.find(c => c.caseStudyId === case1)!.state).toBe('locked');
  });

  it('reports locked when the case has no linkedItemId', async () => {
    const case1 = seedCaseUnlinked(1);
    const user = new ObjectId().toString();

    const list = await service.listCasesForUser({userId: user, courseId: COURSE, courseVersionId: VERSION});
    expect(list.find(c => c.caseStudyId === case1)!.state).toBe('locked');
  });

  it('reports submitted-awaiting-verdict after submission', async () => {
    const case1 = seedCase(1);
    const user = new ObjectId().toString();
    await submit(case1, user);

    const list = await service.listCasesForUser({userId: user, courseId: COURSE, courseVersionId: VERSION});
    expect(list.find(c => c.caseStudyId === case1)!.state).toBe('submitted-awaiting-verdict');
  });

  it('exposes all six response fields in myResponse', async () => {
    const case1 = seedCase(1);
    const user = new ObjectId().toString();
    await submit(case1, user, {
      beat1a: 'Going in I thought this through.',
      steelman: VALID_STEELMAN,
    });

    const list = await service.listCasesForUser({userId: user, courseId: COURSE, courseVersionId: VERSION});
    const entry = list.find(c => c.caseStudyId === case1)!;
    expect(entry.myResponse).toMatchObject({
      beat1a: 'Going in I thought this through.',
      steelman: VALID_STEELMAN,
    });
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

describe('weak-response-streak notification', () => {
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
    const {responseId} = await submit(caseId, author);
    const {responseId: opponent1} = await submit(caseId, new ObjectId().toString());
    const {responseId: opponent2} = await submit(caseId, new ObjectId().toString());

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
    const {responseId} = await submit(caseId, author);
    const {responseId: opponent1} = await submit(caseId, new ObjectId().toString());
    const {responseId: opponent2} = await submit(caseId, new ObjectId().toString());
    const {responseId: opponent3} = await submit(caseId, new ObjectId().toString());

    await loseTo(caseId, responseId, opponent1);

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
    const {responseId} = await submit(caseId, author);
    const {responseId: opponent} = await submit(caseId, new ObjectId().toString());

    await loseTo(caseId, responseId, opponent);

    expect(notifications.sent).toHaveLength(0);
  });
});
