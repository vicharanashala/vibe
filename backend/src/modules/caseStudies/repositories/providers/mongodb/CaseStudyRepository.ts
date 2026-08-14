import 'reflect-metadata';
import {Collection, ObjectId} from 'mongodb';
import {inject, injectable} from 'inversify';
import {MongoDatabase} from '#shared/database/providers/mongo/MongoDatabase.js';
import {GLOBAL_TYPES} from '#root/types.js';
import {CaseStudy, ICaseStudy} from '../../../classes/transformers/CaseStudy.js';
import {
  CaseResponse,
  ICaseResponse,
} from '../../../classes/transformers/CaseResponse.js';
import {
  CaseComparisonOutcome,
  ICaseComparison,
} from '../../../classes/transformers/CaseComparison.js';
import {WINS_REQUIRED, UNJUDGEABLE_FLAG_THRESHOLD} from '../../../constants.js';

/**
 * One counter per (reviewer, case): substantive verdicts (A/B/BOTH_WEAK) this
 * reviewer has completed for this case. A progress counter only — reviewing
 * is open-ended (Milestone 0's resolved default), so nothing here caps it.
 */
interface ICaseReviewQuota {
  _id?: ObjectId;
  reviewerId: ObjectId;
  caseStudyId: ObjectId;
  validPicks: number;
}

export interface ICaseStudyStats {
  casesPublished: number;
  totalResponses: number;
  responsesPerCase: Array<{
    caseStudyId: string;
    sequenceIndex: number;
    title: string;
    responseCount: number;
    wonCount: number;
  }>;
  flaggedCount: number;
  averageComparisonsToWin: number | null;
}

export interface IIntegrationLearnerProgress {
  userId: string;
  casesSubmitted: number;
  casesWon: number;
  casesInReview: number;
  lastActivityAt: Date | null;
}

/** Sorts a response pair into a stable order, independent of which was picked first. */
function normalizePair(a: ObjectId, b: ObjectId): [ObjectId, ObjectId] {
  return a.toString() <= b.toString() ? [a, b] : [b, a];
}

@injectable()
export class CaseStudyRepository {
  private caseStudies!: Collection<ICaseStudy>;
  private caseResponses!: Collection<ICaseResponse>;
  private caseComparisons!: Collection<ICaseComparison>;
  private caseReviewQuota!: Collection<ICaseReviewQuota>;
  private initialized = false;

  constructor(@inject(GLOBAL_TYPES.Database) private db: MongoDatabase) {}

  private async init(): Promise<void> {
    if (this.initialized) return;
    this.caseStudies = await this.db.getCollection<ICaseStudy>('caseStudies');
    this.caseResponses =
      await this.db.getCollection<ICaseResponse>('caseResponses');
    this.caseComparisons =
      await this.db.getCollection<ICaseComparison>('caseComparisons');
    this.caseReviewQuota =
      await this.db.getCollection<ICaseReviewQuota>('caseReviewQuota');
    this.initialized = true;

    try {
      // Write-unlock order is unique per version.
      await this.caseStudies.createIndex(
        {courseVersionId: 1, sequenceIndex: 1},
        {unique: true, background: true},
      );
      // One response per participant per case.
      await this.caseResponses.createIndex(
        {userId: 1, caseStudyId: 1},
        {unique: true, background: true},
      );
      // Serving pool: open responses for a case, least-won / least-served first.
      await this.caseResponses.createIndex(
        {caseStudyId: 1, status: 1, winCount: 1, comparisonsSeenCount: 1},
        {background: true},
      );
      // Never serve the same reviewer the same pair twice. Callers must
      // normalise A/B by sorted id (see normalizePair) before every read and
      // write against this index, so {A,B} and {B,A} collide as intended.
      await this.caseComparisons.createIndex(
        {reviewerId: 1, responseAId: 1, responseBId: 1},
        {unique: true, background: true},
      );
      // The re-serve lookup: at most one undecided pair per (reviewer, case).
      await this.caseComparisons.createIndex(
        {reviewerId: 1, caseStudyId: 1, outcome: 1},
        {background: true},
      );
      await this.caseReviewQuota.createIndex(
        {reviewerId: 1, caseStudyId: 1},
        {unique: true, background: true},
      );
    } catch {
      // Indexes already exist.
    }
  }

  // ---------------------------------------------------------------------
  // Case studies (authoring / listing)
  // ---------------------------------------------------------------------

  async listByCourseVersion(courseVersionId: string): Promise<ICaseStudy[]> {
    await this.init();
    return this.caseStudies
      .find({
        courseVersionId: new ObjectId(courseVersionId),
        isDeleted: {$ne: true},
      })
      .sort({sequenceIndex: 1})
      .toArray();
  }

  async findById(caseStudyId: string): Promise<ICaseStudy | null> {
    await this.init();
    return this.caseStudies.findOne({
      _id: new ObjectId(caseStudyId),
      isDeleted: {$ne: true},
    });
  }

  /**
   * Locate a case by its position in the version's sequence. Used by the
   * win-based unlock check: before a student can submit Case N, the service
   * must verify that Case N-1 has already been won.
   */
  async findByVersionAndSequenceIndex(
    courseVersionId: string,
    sequenceIndex: number,
  ): Promise<ICaseStudy | null> {
    await this.init();
    return this.caseStudies.findOne({
      courseVersionId: new ObjectId(courseVersionId),
      sequenceIndex,
      isDeleted: {$ne: true},
    });
  }

  /**
   * Insert a case study. Returns null when the unique
   * `(courseVersionId, sequenceIndex)` index rejects it as a duplicate
   * position, mirroring `ReflectionRepository.create`'s null-on-duplicate
   * contract.
   */
  async create(caseStudy: CaseStudy): Promise<string | null> {
    await this.init();
    try {
      const result = await this.caseStudies.insertOne(caseStudy);
      return result.insertedId.toString();
    } catch (e: any) {
      if (e?.code === 11000) return null;
      throw e;
    }
  }

  async update(
    caseStudyId: string,
    patch: {
      title?: string;
      bodyMarkdown?: string;
      sequenceIndex?: number;
      linkedItemId?: string;
    },
  ): Promise<boolean> {
    await this.init();
    const $set: Record<string, unknown> = {updatedAt: new Date()};
    if (patch.title !== undefined) $set.title = patch.title;
    if (patch.bodyMarkdown !== undefined) $set.bodyMarkdown = patch.bodyMarkdown;
    if (patch.sequenceIndex !== undefined) $set.sequenceIndex = patch.sequenceIndex;
    if (patch.linkedItemId !== undefined) {
      $set.linkedItemId = new ObjectId(patch.linkedItemId);
    }
    const result = await this.caseStudies.updateOne(
      {_id: new ObjectId(caseStudyId)},
      {$set},
    );
    return result.matchedCount > 0;
  }

  async softDelete(caseStudyId: string): Promise<boolean> {
    await this.init();
    const result = await this.caseStudies.updateOne(
      {_id: new ObjectId(caseStudyId)},
      {$set: {isDeleted: true, updatedAt: new Date()}},
    );
    return result.matchedCount > 0;
  }

  /**
   * Idempotent upsert from the version-controlled seed file, keyed on
   * `(courseVersionId, sequenceIndex)` — re-running the seed script updates
   * existing cases in place rather than duplicating them.
   */
  async upsertFromSeed(
    courseVersionId: string,
    courseId: string,
    entries: Array<{
      sequenceIndex: number;
      title: string;
      bodyMarkdown: string;
      linkedItemId?: string;
    }>,
  ): Promise<{inserted: number; updated: number}> {
    await this.init();
    let inserted = 0;
    let updated = 0;
    for (const entry of entries) {
      const result = await this.caseStudies.updateOne(
        {
          courseVersionId: new ObjectId(courseVersionId),
          sequenceIndex: entry.sequenceIndex,
        },
        {
          $set: {
            title: entry.title,
            bodyMarkdown: entry.bodyMarkdown,
            ...(entry.linkedItemId
              ? {linkedItemId: new ObjectId(entry.linkedItemId)}
              : {}),
            isDeleted: false,
            updatedAt: new Date(),
          },
          $setOnInsert: {
            courseVersionId: new ObjectId(courseVersionId),
            courseId: new ObjectId(courseId),
            sequenceIndex: entry.sequenceIndex,
            createdAt: new Date(),
          },
        },
        {upsert: true},
      );
      if (result.upsertedCount > 0) inserted++;
      else updated++;
    }
    return {inserted, updated};
  }

  // ---------------------------------------------------------------------
  // Responses
  // ---------------------------------------------------------------------

  /**
   * How many cases in this version the user has already submitted a response
   * for. Drives the derived unlock rule — no separate "unlock pointer" is
   * stored. `excludeCaseStudyId` excludes the case currently being
   * submitted: without it, two concurrent submissions for the *same* case
   * can race so that whichever insert commits first bumps the count the
   * other reads, making the second (still in-flight) request see itself as
   * "one case further along" and fail with a misleading "not yet unlocked"
   * instead of the correct "already submitted".
   */
  async countUserResponses(
    userId: string,
    courseVersionId: string,
    excludeCaseStudyId?: string,
  ): Promise<number> {
    await this.init();
    return this.caseResponses.countDocuments({
      userId: new ObjectId(userId),
      courseVersionId: new ObjectId(courseVersionId),
      ...(excludeCaseStudyId
        ? {caseStudyId: {$ne: new ObjectId(excludeCaseStudyId)}}
        : {}),
    });
  }

  async listUserResponsesForVersion(
    userId: string,
    courseVersionId: string,
  ): Promise<ICaseResponse[]> {
    await this.init();
    return this.caseResponses
      .find({
        userId: new ObjectId(userId),
        courseVersionId: new ObjectId(courseVersionId),
      })
      .toArray();
  }

  async findUserResponse(
    userId: string,
    caseStudyId: string,
  ): Promise<ICaseResponse | null> {
    await this.init();
    return this.caseResponses.findOne({
      userId: new ObjectId(userId),
      caseStudyId: new ObjectId(caseStudyId),
    });
  }

  async findResponseById(responseId: string): Promise<ICaseResponse | null> {
    await this.init();
    return this.caseResponses.findOne({_id: new ObjectId(responseId)});
  }

  /**
   * Insert a response. Returns null when the unique `(userId, caseStudyId)`
   * index rejects a duplicate, so two racing submissions from one student
   * become a clean "already submitted" rather than an uncaught duplicate-key
   * error — mirrors `ReflectionRepository.create`.
   */
  async createResponse(response: CaseResponse): Promise<string | null> {
    await this.init();
    try {
      const result = await this.caseResponses.insertOne(response);
      return result.insertedId.toString();
    } catch (e: any) {
      if (e?.code === 11000) return null;
      throw e;
    }
  }

  /**
   * Replace a response's text and restart its review cycle from scratch.
   * Resets winCount, weakStreak, comparisonsSeenCount, and flagCount to 0
   * and flips status back to OPEN. Also deletes any pending (undecided)
   * comparisons that reference the old text — they reference stale content
   * and must not feed into the fresh cycle.
   *
   * Matches OPEN and WITHDRAWN responses (WON ones cannot be revised).
   * Resets all counters and flips status back to OPEN atomically.
   * Returns false when no matching document was found.
   */
  async reviseResponse(
    userId: string,
    caseStudyId: string,
    newText: string,
  ): Promise<boolean> {
    await this.init();
    const updated = await this.caseResponses.findOneAndUpdate(
      {
        userId: new ObjectId(userId),
        caseStudyId: new ObjectId(caseStudyId),
        status: {$in: ['OPEN', 'WITHDRAWN']},
      },
      {
        $set: {
          text: newText,
          status: 'OPEN',
          winCount: 0,
          weakStreak: 0,
          comparisonsSeenCount: 0,
          flagCount: 0,
          updatedAt: new Date(),
        },
      },
      {returnDocument: 'after'},
    );
    if (!updated) return false;
    await this.caseComparisons.deleteMany({
      outcome: {$exists: false},
      $or: [{responseAId: updated._id}, {responseBId: updated._id}],
    });
    return true;
  }

  // ---------------------------------------------------------------------
  // Pairing / comparisons
  // ---------------------------------------------------------------------

  /**
   * An undecided pair already served to this reviewer for this case, if one
   * exists. Re-serving it (instead of picking a new one) is what makes
   * leaving and returning to the screen restart the timer rather than
   * letting a refresh dodge it.
   */
  async findPendingComparison(
    reviewerId: string,
    caseStudyId: string,
  ): Promise<ICaseComparison | null> {
    await this.init();
    return this.caseComparisons.findOne({
      reviewerId: new ObjectId(reviewerId),
      caseStudyId: new ObjectId(caseStudyId),
      outcome: {$exists: false},
    });
  }

  async findComparisonById(comparisonId: string): Promise<ICaseComparison | null> {
    await this.init();
    return this.caseComparisons.findOne({_id: new ObjectId(comparisonId)});
  }

  /**
   * Pick two OPEN responses to this case, excluding the reviewer's own and
   * every pair already served to this reviewer. Biased toward the
   * least-won/least-served responses first (mirrors
   * `ReflectionRepository.findNextForReview`'s spread-coverage sort) so early
   * submissions don't monopolise review attention.
   *
   * The candidate pool is a small batch (20), and pairs within it are
   * checked in-memory against the reviewer's seen-set — cheap at this scale,
   * and avoids a much fancier query for what is, per case, a small pool.
   */
  async pickPairCandidate(
    caseStudyId: string,
    reviewerId: string,
  ): Promise<[ICaseResponse, ICaseResponse] | null> {
    await this.init();
    const caseObjId = new ObjectId(caseStudyId);
    const reviewerObjId = new ObjectId(reviewerId);

    const pool = await this.caseResponses
      .find({
        caseStudyId: caseObjId,
        status: 'OPEN',
        userId: {$ne: reviewerObjId},
      })
      .sort({winCount: 1, comparisonsSeenCount: 1})
      .limit(20)
      .toArray();

    if (pool.length < 2) return null;

    const seenPairs = await this.caseComparisons
      .find(
        {reviewerId: reviewerObjId, caseStudyId: caseObjId},
        {projection: {responseAId: 1, responseBId: 1}},
      )
      .toArray();
    const seenKeys = new Set(
      seenPairs.map(p => `${p.responseAId.toString()}:${p.responseBId.toString()}`),
    );

    for (let i = 0; i < pool.length; i++) {
      for (let j = i + 1; j < pool.length; j++) {
        const [a, b] = normalizePair(pool[i]._id!, pool[j]._id!);
        const key = `${a.toString()}:${b.toString()}`;
        if (!seenKeys.has(key)) {
          return [pool[i], pool[j]];
        }
      }
    }
    return null;
  }

  /**
   * Returns null when the unique `(reviewerId, responseAId, responseBId)`
   * index rejects a duplicate — a concurrent request from the same reviewer
   * just served this exact pair. The service treats that as "already
   * pending" rather than an error.
   */
  async createComparison(input: {
    caseStudyId: string;
    courseVersionId: string;
    reviewerId: string;
    responseAId: string;
    responseBId: string;
    sideAIsLeft: boolean;
    servedAt: Date;
    minimumScreenTimeSeconds: number;
  }): Promise<ICaseComparison | null> {
    await this.init();
    const [responseAId, responseBId] = normalizePair(
      new ObjectId(input.responseAId),
      new ObjectId(input.responseBId),
    );
    const doc: ICaseComparison = {
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
    try {
      const result = await this.caseComparisons.insertOne(doc);
      return {...doc, _id: result.insertedId};
    } catch (e: any) {
      if (e?.code === 11000) return null;
      throw e;
    }
  }

  /**
   * Record the verdict on a served pair. The filter requiring `outcome` to
   * be unset is the double-pick guard: two concurrent picks against the same
   * comparison can't both succeed, mirroring the capped update in
   * `ReflectionRepository.recordReview`.
   */
  async recordPick(input: {
    comparisonId: string;
    outcome: CaseComparisonOutcome;
  }): Promise<ICaseComparison | null> {
    await this.init();
    return this.caseComparisons.findOneAndUpdate(
      {_id: new ObjectId(input.comparisonId), outcome: {$exists: false}},
      {$set: {outcome: input.outcome, decidedAt: new Date()}},
      {returnDocument: 'after'},
    );
  }

  /**
   * Fold a decided comparison's outcome into both responses' counters.
   * `comparisonsSeenCount` increments for both responses regardless of
   * outcome; a win or a flag then independently, atomically checks whether
   * the response just crossed its threshold and flips its status — the
   * `status: 'OPEN'` guard on that second update is what stops two
   * concurrent winning picks from both "closing" the same response.
   *
   * Also folds each response's `weakStreak`: the losing side(s) of a
   * substantive verdict (A/B/BOTH_WEAK) get it incremented, the winning side
   * gets it reset to 0. Returns the post-increment streak for every response
   * that was NOT reset, so the caller can compare against the course's
   * configured notification threshold without a second read.
   */
  async applyPickEffects(input: {
    responseAId: ObjectId;
    responseBId: ObjectId;
    outcome: CaseComparisonOutcome;
  }): Promise<{
    weakStreaks: Array<{responseId: ObjectId; userId: ObjectId; weakStreak: number}>;
    withdrawals: Array<{responseId: ObjectId; userId: ObjectId; withdrawn: boolean}>;
  }> {
    await this.init();
    const {responseAId, responseBId, outcome} = input;

    await this.caseResponses.updateMany(
      {_id: {$in: [responseAId, responseBId]}},
      {$inc: {comparisonsSeenCount: 1}, $set: {updatedAt: new Date()}},
    );

    const weakStreaks: Array<{responseId: ObjectId; userId: ObjectId; weakStreak: number}> = [];
    const withdrawals: Array<{responseId: ObjectId; userId: ObjectId; withdrawn: boolean}> = [];

    if (outcome === 'A' || outcome === 'B') {
      const winnerId = outcome === 'A' ? responseAId : responseBId;
      const loserId = outcome === 'A' ? responseBId : responseAId;
      await Promise.all([this.incrementWin(winnerId), this.resetWeakStreak(winnerId)]);
      const loserStreak = await this.incrementWeakStreak(loserId);
      if (loserStreak) weakStreaks.push(loserStreak);
    } else if (outcome === 'FLAGGED') {
      // Increment flags and atomically withdraw if threshold is crossed.
      // Does not fold into the weak-response streak — it wasn't judged.
      const [flagA, flagB] = await Promise.all([
        this.incrementFlag(responseAId),
        this.incrementFlag(responseBId),
      ]);
      withdrawals.push(flagA, flagB);
    } else {
      // BOTH_WEAK: a substantive judgment against both sides.
      const [a, b] = await Promise.all([
        this.incrementWeakStreak(responseAId),
        this.incrementWeakStreak(responseBId),
      ]);
      if (a) weakStreaks.push(a);
      if (b) weakStreaks.push(b);
    }

    return {weakStreaks, withdrawals};
  }

  private async incrementWin(responseId: ObjectId): Promise<void> {
    const updated = await this.caseResponses.findOneAndUpdate(
      {_id: responseId},
      {$inc: {winCount: 1}, $set: {updatedAt: new Date()}},
      {returnDocument: 'after'},
    );
    if (updated && updated.status === 'OPEN' && updated.winCount >= WINS_REQUIRED) {
      await this.caseResponses.updateOne(
        {_id: responseId, status: 'OPEN'},
        {$set: {status: 'WON', updatedAt: new Date()}},
      );
    }
  }

  /**
   * Increments the flag counter and withdraws the response if it crosses
   * UNJUDGEABLE_FLAG_THRESHOLD. The status flip and the $inc are a single
   * atomic findOneAndUpdate — no second write, no TOCTOU gap.
   * Only OPEN responses can be withdrawn; WON ones are left alone.
   */
  private async incrementFlag(
    responseId: ObjectId,
  ): Promise<{responseId: ObjectId; userId: ObjectId; withdrawn: boolean}> {
    const updated = await this.caseResponses.findOneAndUpdate(
      {_id: responseId, status: 'OPEN'},
      {$inc: {flagCount: 1}, $set: {updatedAt: new Date()}},
      {returnDocument: 'after'},
    );
    if (!updated) return {responseId, userId: new ObjectId(), withdrawn: false};
    if (updated.flagCount >= UNJUDGEABLE_FLAG_THRESHOLD) {
      // Atomic: only flips if still OPEN (guard prevents double-withdraw on concurrent flags).
      await this.caseResponses.updateOne(
        {_id: responseId, status: 'OPEN'},
        {$set: {status: 'WITHDRAWN', updatedAt: new Date()}},
      );
      return {responseId, userId: updated.userId, withdrawn: true};
    }
    return {responseId, userId: updated.userId, withdrawn: false};
  }

  private async incrementWeakStreak(
    responseId: ObjectId,
  ): Promise<{responseId: ObjectId; userId: ObjectId; weakStreak: number} | null> {
    const updated = await this.caseResponses.findOneAndUpdate(
      {_id: responseId},
      {$inc: {weakStreak: 1}, $set: {updatedAt: new Date()}},
      {returnDocument: 'after'},
    );
    if (!updated) return null;
    return {responseId, userId: updated.userId, weakStreak: updated.weakStreak};
  }

  private async resetWeakStreak(responseId: ObjectId): Promise<void> {
    await this.caseResponses.updateOne(
      {_id: responseId},
      {$set: {weakStreak: 0, updatedAt: new Date()}},
    );
  }

  async incrementReviewerQuota(
    reviewerId: string,
    caseStudyId: string,
  ): Promise<void> {
    await this.init();
    await this.caseReviewQuota.updateOne(
      {reviewerId: new ObjectId(reviewerId), caseStudyId: new ObjectId(caseStudyId)},
      {$inc: {validPicks: 1}},
      {upsert: true},
    );
  }

  async getReviewerQuota(reviewerId: string, caseStudyId: string): Promise<number> {
    await this.init();
    const doc = await this.caseReviewQuota.findOne({
      reviewerId: new ObjectId(reviewerId),
      caseStudyId: new ObjectId(caseStudyId),
    });
    return doc?.validPicks ?? 0;
  }

  /**
   * How every reviewer who has seen this exact pair (any reviewer, not just
   * the caller) verdicted it — powers the post-pick "X of the readers so far
   * chose the same one" figure. Counts readers of *this specific pair*, not
   * either response's overall win record (PLANNING.md/TASK.md Milestone 10).
   */
  async getPairOutcomeCounts(
    responseAId: ObjectId,
    responseBId: ObjectId,
  ): Promise<Record<CaseComparisonOutcome, number>> {
    await this.init();
    const rows = await this.caseComparisons
      .aggregate<{_id: CaseComparisonOutcome; count: number}>([
        {$match: {responseAId, responseBId, outcome: {$exists: true}}},
        {$group: {_id: '$outcome', count: {$sum: 1}}},
      ])
      .toArray();
    const counts: Record<CaseComparisonOutcome, number> = {
      A: 0,
      B: 0,
      BOTH_WEAK: 0,
      FLAGGED: 0,
    };
    for (const row of rows) counts[row._id] = row.count;
    return counts;
  }

  // ---------------------------------------------------------------------
  // Instructor stats / Samagama integration roster
  // ---------------------------------------------------------------------

  async getStats(courseVersionId: string): Promise<ICaseStudyStats> {
    await this.init();
    const cases = await this.listByCourseVersion(courseVersionId);
    const caseIds = cases.map(c => c._id!);

    const responseAgg = await this.caseResponses
      .aggregate<{_id: ObjectId; count: number; won: number}>([
        {$match: {caseStudyId: {$in: caseIds}}},
        {
          $group: {
            _id: '$caseStudyId',
            count: {$sum: 1},
            won: {$sum: {$cond: [{$eq: ['$status', 'WON']}, 1, 0]}},
          },
        },
      ])
      .toArray();
    const byCase = new Map(responseAgg.map(r => [r._id.toString(), r]));

    const flaggedCount = await this.caseResponses.countDocuments({
      caseStudyId: {$in: caseIds},
      flagCount: {$gt: 0},
    });

    const wonAgg = await this.caseResponses
      .aggregate<{avgComparisons: number}>([
        {$match: {caseStudyId: {$in: caseIds}, status: 'WON'}},
        {$group: {_id: null, avgComparisons: {$avg: '$comparisonsSeenCount'}}},
      ])
      .toArray();

    return {
      casesPublished: cases.length,
      totalResponses: responseAgg.reduce((sum, r) => sum + r.count, 0),
      responsesPerCase: cases.map(c => ({
        caseStudyId: c._id!.toString(),
        sequenceIndex: c.sequenceIndex,
        title: c.title,
        responseCount: byCase.get(c._id!.toString())?.count ?? 0,
        wonCount: byCase.get(c._id!.toString())?.won ?? 0,
      })),
      flaggedCount,
      averageComparisonsToWin: wonAgg[0]
        ? Math.round(wonAgg[0].avgComparisons * 100) / 100
        : null,
    };
  }

  /**
   * Per-learner facts for the Samagama-facing integration roster. Reports
   * `casesSubmitted`/`casesWon`/`casesInReview` only — it never computes a
   * "N of ~20 complete" boolean, since that completion rule is Samagama's to
   * apply (PLANNING.md §4.2), not ViBe's.
   */
  async getIntegrationProgress(input: {
    courseVersionId: string;
    page: number;
    limit: number;
  }): Promise<{totalLearners: number; learners: IIntegrationLearnerProgress[]}> {
    await this.init();
    const versionObjId = new ObjectId(input.courseVersionId);
    const skip = (input.page - 1) * input.limit;

    const rows = await this.caseResponses
      .aggregate<{
        _id: ObjectId;
        casesSubmitted: number;
        casesWon: number;
        casesInReview: number;
        lastActivityAt: Date;
      }>([
        {$match: {courseVersionId: versionObjId}},
        {
          $group: {
            _id: '$userId',
            casesSubmitted: {$sum: 1},
            casesWon: {$sum: {$cond: [{$eq: ['$status', 'WON']}, 1, 0]}},
            casesInReview: {$sum: {$cond: [{$eq: ['$status', 'OPEN']}, 1, 0]}},
            lastActivityAt: {$max: '$updatedAt'},
          },
        },
        {$sort: {_id: 1}},
        {$skip: skip},
        {$limit: input.limit},
      ])
      .toArray();

    const countRows = await this.caseResponses
      .aggregate<{total: number}>([
        {$match: {courseVersionId: versionObjId}},
        {$group: {_id: '$userId'}},
        {$count: 'total'},
      ])
      .toArray();

    return {
      totalLearners: countRows[0]?.total ?? 0,
      learners: rows.map(r => ({
        userId: r._id.toString(),
        casesSubmitted: r.casesSubmitted,
        casesWon: r.casesWon,
        casesInReview: r.casesInReview,
        lastActivityAt: r.lastActivityAt ?? null,
      })),
    };
  }
}
