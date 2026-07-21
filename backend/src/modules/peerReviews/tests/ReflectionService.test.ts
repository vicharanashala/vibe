/**
 * Unit tests for ReflectionService against an in-memory fake repository.
 *
 * These cover the policy the feature lives or dies by — the reciprocity gate,
 * the minimum-reviews reveal threshold, self-review refusal, and the anonymity
 * of the reviewer-facing payload. Mongo-level concurrency (the unique index and
 * the capped $inc) is the repository's contract and is faked here rather than
 * re-tested.
 */
import {describe, it, expect, beforeEach} from 'vitest';
import {ObjectId} from 'mongodb';
import {ReflectionService} from '../services/ReflectionService.js';
import {
  IReflection,
  IReflectionScores,
  averageOfScores,
} from '../classes/transformers/Reflection.js';
import {
  MAX_REVIEWS_PER_REFLECTION,
  MIN_REVIEWS_TO_REVEAL,
  REQUIRED_REVIEWS_TO_UNLOCK,
} from '../constants.js';

const SECTION = new ObjectId().toString();
const COURSE = new ObjectId().toString();
const VERSION = new ObjectId().toString();
const MODULE = new ObjectId().toString();

const scores = (n: number): IReflectionScores => ({
  understanding: n,
  depth: n,
  clarity: n,
});

/** Minimal in-memory stand-in for ReflectionRepository. */
class FakeRepo {
  reflections: IReflection[] = [];
  reviews: {reflectionId: string; reviewerId: string; sectionId: string}[] = [];

  async create(reflection: IReflection): Promise<string> {
    const _id = new ObjectId();
    this.reflections.push({...reflection, _id});
    return _id.toString();
  }

  async findById(id: string) {
    return this.reflections.find(r => r._id!.toString() === id) ?? null;
  }

  async findByUserAndSection(userId: string, sectionId: string) {
    return (
      this.reflections.find(
        r =>
          r.userId.toString() === userId && r.sectionId.toString() === sectionId,
      ) ?? null
    );
  }

  async listReviewedReflectionIds(reviewerId: string, sectionId: string) {
    return this.reviews
      .filter(v => v.reviewerId === reviewerId && v.sectionId === sectionId)
      .map(v => v.reflectionId);
  }

  async countReviewsByReviewer(reviewerId: string, sectionId: string) {
    return (await this.listReviewedReflectionIds(reviewerId, sectionId)).length;
  }

  async findNextForReview(input: {reviewerId: string; sectionId: string}) {
    const seen = await this.listReviewedReflectionIds(
      input.reviewerId,
      input.sectionId,
    );
    return (
      this.reflections
        .filter(
          r =>
            r.sectionId.toString() === input.sectionId &&
            r.status === 'OPEN' &&
            r.userId.toString() !== input.reviewerId &&
            r.reviewCount < MAX_REVIEWS_PER_REFLECTION &&
            !seen.includes(r._id!.toString()),
        )
        .sort((a, b) => a.reviewCount - b.reviewCount)[0] ?? null
    );
  }

  async recordReview(input: {
    reflectionId: string;
    reviewerId: string;
    sectionId: string;
    scores: IReflectionScores;
    helpful: boolean;
  }) {
    const already = this.reviews.some(
      v =>
        v.reflectionId === input.reflectionId &&
        v.reviewerId === input.reviewerId,
    );
    if (already) return {applied: false as const, reason: 'DUPLICATE' as const};

    const reflection = await this.findById(input.reflectionId);
    if (!reflection || reflection.reviewCount >= MAX_REVIEWS_PER_REFLECTION) {
      return {applied: false as const, reason: 'CAPPED' as const};
    }

    this.reviews.push({
      reflectionId: input.reflectionId,
      reviewerId: input.reviewerId,
      sectionId: input.sectionId,
    });
    reflection.reviewCount += 1;
    reflection.scoreSum += averageOfScores(input.scores);
    if (input.helpful) reflection.helpfulCount += 1;
    if (reflection.reviewCount >= MAX_REVIEWS_PER_REFLECTION) {
      reflection.status = 'CLOSED';
    }
    return {applied: true as const, reviewCount: reflection.reviewCount};
  }
}

let repo: FakeRepo;
let service: ReflectionService;

const submit = (userId: string, text = 'x'.repeat(120), confidence = 5) =>
  service.submitReflection({
    userId,
    courseId: COURSE,
    courseVersionId: VERSION,
    moduleId: MODULE,
    sectionId: SECTION,
    text,
    confidence,
  });

/** Have `count` distinct peers each review `reflectionId` with score `n`. */
async function reviewedByPeers(reflectionId: string, count: number, n = 8) {
  for (let i = 0; i < count; i++) {
    await service.submitReview({
      reviewerId: new ObjectId().toString(),
      reflectionId,
      scores: scores(n),
      helpful: false,
    });
  }
}

/** Have `author` complete `count` reviews so their own score unlocks. */
async function completeQuota(author: string, count: number) {
  for (let i = 0; i < count; i++) {
    const peerId = new ObjectId().toString();
    const {reflectionId} = await submit(peerId);
    await service.submitReview({
      reviewerId: author,
      reflectionId,
      scores: scores(7),
      helpful: false,
    });
  }
}

beforeEach(() => {
  repo = new FakeRepo();
  service = new ReflectionService(repo as never);
});

describe('submitReflection', () => {
  it('rejects a body shorter than the minimum length', async () => {
    await expect(submit(new ObjectId().toString(), 'too short')).rejects.toThrow(
      /at least/i,
    );
  });

  it('rejects a confidence rating outside 1-10', async () => {
    await expect(
      submit(new ObjectId().toString(), 'x'.repeat(120), 11),
    ).rejects.toThrow(/confidence/i);
  });

  it('refuses a second reflection for the same section', async () => {
    const author = new ObjectId().toString();
    await submit(author);
    await expect(submit(author)).rejects.toThrow(/already submitted/i);
  });
});

describe('getNextForReview', () => {
  it('never serves a student their own reflection', async () => {
    const author = new ObjectId().toString();
    await submit(author);
    const next = await service.getNextForReview({
      userId: author,
      sectionId: SECTION,
    });
    expect(next).toBeNull();
  });

  it('exposes no author-identifying fields to the reviewer', async () => {
    await submit(new ObjectId().toString());
    const next = await service.getNextForReview({
      userId: new ObjectId().toString(),
      sectionId: SECTION,
    });
    expect(next).not.toBeNull();
    expect(Object.keys(next!).sort()).toEqual([
      'reflectionId',
      'reviewsCompleted',
      'reviewsRequired',
      'text',
    ]);
  });

  it('serves the least-reviewed reflection first', async () => {
    const {reflectionId: busy} = await submit(new ObjectId().toString());
    await reviewedByPeers(busy, 2);
    const {reflectionId: quiet} = await submit(new ObjectId().toString());

    const next = await service.getNextForReview({
      userId: new ObjectId().toString(),
      sectionId: SECTION,
    });
    expect(next!.reflectionId).toBe(quiet);
  });
});

describe('submitReview', () => {
  it('refuses a self-review', async () => {
    const author = new ObjectId().toString();
    const {reflectionId} = await submit(author);
    await expect(
      service.submitReview({
        reviewerId: author,
        reflectionId,
        scores: scores(9),
        helpful: true,
      }),
    ).rejects.toThrow(/cannot review your own/i);
  });

  it('refuses a second review of the same reflection by the same peer', async () => {
    const {reflectionId} = await submit(new ObjectId().toString());
    const reviewer = new ObjectId().toString();
    const review = () =>
      service.submitReview({
        reviewerId: reviewer,
        reflectionId,
        scores: scores(6),
        helpful: false,
      });
    await review();
    await expect(review()).rejects.toThrow(/already reviewed/i);
  });

  it('refuses a review once the reflection has hit its cap', async () => {
    const {reflectionId} = await submit(new ObjectId().toString());
    await reviewedByPeers(reflectionId, MAX_REVIEWS_PER_REFLECTION);
    await expect(
      service.submitReview({
        reviewerId: new ObjectId().toString(),
        reflectionId,
        scores: scores(5),
        helpful: false,
      }),
    ).rejects.toThrow(/enough reviews/i);
  });

  it('rejects a criterion outside 1-10', async () => {
    const {reflectionId} = await submit(new ObjectId().toString());
    await expect(
      service.submitReview({
        reviewerId: new ObjectId().toString(),
        reflectionId,
        scores: {understanding: 11, depth: 5, clarity: 5},
        helpful: false,
      }),
    ).rejects.toThrow(/understanding/i);
  });
});

describe('getMyReflection score reveal', () => {
  it('withholds the score until the author has reviewed their quota', async () => {
    const author = new ObjectId().toString();
    const {reflectionId} = await submit(author);
    await reviewedByPeers(reflectionId, MIN_REVIEWS_TO_REVEAL);

    const mine = await service.getMyReflection({
      userId: author,
      sectionId: SECTION,
    });
    expect(mine!.averageScore).toBeNull();
    expect(mine!.lockedReason).toBe('REVIEWS_PENDING');
  });

  it('withholds the score when too few peers have reviewed it', async () => {
    const author = new ObjectId().toString();
    const {reflectionId} = await submit(author);
    await reviewedByPeers(reflectionId, MIN_REVIEWS_TO_REVEAL - 1);
    await completeQuota(author, REQUIRED_REVIEWS_TO_UNLOCK);

    const mine = await service.getMyReflection({
      userId: author,
      sectionId: SECTION,
    });
    expect(mine!.averageScore).toBeNull();
    expect(mine!.lockedReason).toBe('AWAITING_PEERS');
  });

  it('reveals the peer average once both conditions are met', async () => {
    const author = new ObjectId().toString();
    const {reflectionId} = await submit(author);
    await reviewedByPeers(reflectionId, MIN_REVIEWS_TO_REVEAL, 8);
    await completeQuota(author, REQUIRED_REVIEWS_TO_UNLOCK);

    const mine = await service.getMyReflection({
      userId: author,
      sectionId: SECTION,
    });
    expect(mine!.averageScore).toBe(8);
    expect(mine!.lockedReason).toBeUndefined();
    expect(mine!.reviewsReceived).toBe(MIN_REVIEWS_TO_REVEAL);
  });

  it('averages differing peer scores rather than taking the latest', async () => {
    const author = new ObjectId().toString();
    const {reflectionId} = await submit(author);
    await reviewedByPeers(reflectionId, 1, 4);
    await reviewedByPeers(reflectionId, 1, 6);
    await reviewedByPeers(reflectionId, 1, 8);
    await completeQuota(author, REQUIRED_REVIEWS_TO_UNLOCK);

    const mine = await service.getMyReflection({
      userId: author,
      sectionId: SECTION,
    });
    expect(mine!.averageScore).toBe(6);
  });

  it('counts helpful marks separately from the score', async () => {
    const author = new ObjectId().toString();
    const {reflectionId} = await submit(author);
    await service.submitReview({
      reviewerId: new ObjectId().toString(),
      reflectionId,
      scores: scores(3),
      helpful: true,
    });

    const mine = await service.getMyReflection({
      userId: author,
      sectionId: SECTION,
    });
    expect(mine!.helpfulCount).toBe(1);
  });

  it('returns null when the student has written nothing for the section', async () => {
    const mine = await service.getMyReflection({
      userId: new ObjectId().toString(),
      sectionId: SECTION,
    });
    expect(mine).toBeNull();
  });
});
