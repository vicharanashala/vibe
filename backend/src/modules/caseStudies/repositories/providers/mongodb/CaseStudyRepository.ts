import 'reflect-metadata';
import {ClientSession, Collection, ObjectId} from 'mongodb';
import {inject, injectable} from 'inversify';
import {MongoDatabase} from '#shared/database/providers/mongo/MongoDatabase.js';
import {GLOBAL_TYPES} from '#root/types.js';
import {ICaseStudy} from '../../../classes/transformers/CaseStudy.js';
import {
  CaseResponse,
  ICaseResponse,
} from '../../../classes/transformers/CaseResponse.js';
import {
  CaseComparisonOutcome,
  ICaseComparison,
} from '../../../classes/transformers/CaseComparison.js';
import {WINS_REQUIRED} from '../../../constants.js';

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
      // Case studies are now course items keyed by _id = itemId, so uniqueness
      // is inherent to the item. The old (courseVersionId, sequenceIndex) unique
      // index from the standalone-authoring model is retired; drop it if a dev
      // DB still carries it, then keep only a non-unique lookup index.
      try {
        await this.caseStudies.dropIndex('courseVersionId_1_sequenceIndex_1');
      } catch {
        // Index absent (fresh DB) — nothing to drop.
      }
      await this.caseStudies.createIndex(
        {courseVersionId: 1},
        {background: true},
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

  async findById(caseStudyId: string): Promise<ICaseStudy | null> {
    await this.init();
    return this.caseStudies.findOne({
      _id: new ObjectId(caseStudyId),
      isDeleted: {$ne: true},
    });
  }

  /**
   * Idempotent sync of the case record backing a CASE_STUDY course item.
   * The case's `_id` is the item's `_id`, so the peer-review runtime keys on
   * the item directly. Called whenever a learner opens the item; safe to call
   * repeatedly. Content-bearing fields are refreshed from the item on each call
   * so instructor edits propagate; runtime counters are left untouched.
   */
  async upsertForItem(input: {
    itemId: string;
    courseId: string;
    courseVersionId: string;
    title: string;
    bodyMarkdown: string;
    reviewsRequired?: number;
    picksRequired?: number;
    weakStreakThreshold?: number;
  }): Promise<void> {
    await this.init();
    const _id = new ObjectId(input.itemId);

    // Config knobs are synced every open so instructor edits take effect
    // immediately. A knob left blank on the item is `$unset` here so the engine
    // falls back to its module default rather than keeping a stale override.
    const knobs = {
      reviewsRequired: input.reviewsRequired,
      picksRequired: input.picksRequired,
      weakStreakThreshold: input.weakStreakThreshold,
    };
    const $set: Record<string, unknown> = {
      title: input.title,
      bodyMarkdown: input.bodyMarkdown,
      isDeleted: false,
      updatedAt: new Date(),
    };
    const $unset: Record<string, ''> = {};
    for (const [key, value] of Object.entries(knobs)) {
      if (value !== undefined) $set[key] = value;
      else $unset[key] = '';
    }

    await this.caseStudies.updateOne(
      {_id},
      {
        $set,
        ...(Object.keys($unset).length ? {$unset} : {}),
        $setOnInsert: {
          courseId: new ObjectId(input.courseId),
          courseVersionId: new ObjectId(input.courseVersionId),
          sequenceIndex: 0,
          createdAt: new Date(),
        },
      },
      {upsert: true},
    );
  }

  // ---------------------------------------------------------------------
  // Responses
  // ---------------------------------------------------------------------

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
    fields: {
      beat1a: string;
      beat1b: string;
      beat1c: string;
      steelman: string;
      roomPerspective: string;
      changeCommitment: string;
    },
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
          ...fields,
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
        {projection: {responseAId: 1, responseBId: 1, outcome: 1}},
      )
      .toArray();
    const seenKeys = new Set(
      seenPairs.map(p => `${p.responseAId.toString()}:${p.responseBId.toString()}`),
    );

    // After a revision the old decided comparisons remain; exclude those response
    // IDs so a revised response is never served to a reviewer who already judged it.
    const judgedResponseIds = new Set<string>();
    for (const p of seenPairs) {
      if (p.outcome !== undefined) {
        judgedResponseIds.add(p.responseAId.toString());
        judgedResponseIds.add(p.responseBId.toString());
      }
    }
    const eligiblePool = judgedResponseIds.size > 0
      ? pool.filter(r => !judgedResponseIds.has(r._id!.toString()))
      : pool;

    if (eligiblePool.length < 2) return null;

    for (let i = 0; i < eligiblePool.length; i++) {
      for (let j = i + 1; j < eligiblePool.length; j++) {
        const [a, b] = normalizePair(eligiblePool[i]._id!, eligiblePool[j]._id!);
        const key = `${a.toString()}:${b.toString()}`;
        if (!seenKeys.has(key)) {
          return [eligiblePool[i], eligiblePool[j]];
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
  async recordPick(
    input: {comparisonId: string; outcome: CaseComparisonOutcome},
    session?: ClientSession,
  ): Promise<ICaseComparison | null> {
    await this.init();
    return this.caseComparisons.findOneAndUpdate(
      {_id: new ObjectId(input.comparisonId), outcome: {$exists: false}},
      {$set: {outcome: input.outcome, decidedAt: new Date()}},
      {returnDocument: 'after', session},
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
  async applyPickEffects(
    input: {
      responseAId: ObjectId;
      responseBId: ObjectId;
      outcome: CaseComparisonOutcome;
      /** Wins needed to settle this case; falls back to WINS_REQUIRED when omitted. */
      winsRequired?: number;
    },
    session?: ClientSession,
  ): Promise<{
    weakStreaks: Array<{responseId: ObjectId; userId: ObjectId; weakStreak: number}>;
    withdrawals: Array<{responseId: ObjectId; userId: ObjectId; withdrawn: boolean}>;
  }> {
    await this.init();
    const {responseAId, responseBId, outcome} = input;
    const winsRequired = input.winsRequired ?? WINS_REQUIRED;

    await this.caseResponses.updateMany(
      {_id: {$in: [responseAId, responseBId]}},
      {$inc: {comparisonsSeenCount: 1}, $set: {updatedAt: new Date()}},
      {session},
    );

    const weakStreaks: Array<{responseId: ObjectId; userId: ObjectId; weakStreak: number}> = [];
    const withdrawals: Array<{responseId: ObjectId; userId: ObjectId; withdrawn: boolean}> = [];

    if (outcome === 'A' || outcome === 'B') {
      const winnerId = outcome === 'A' ? responseAId : responseBId;
      const loserId = outcome === 'A' ? responseBId : responseAId;
      await Promise.all([
        this.incrementWin(winnerId, winsRequired, session),
        this.resetWeakStreak(winnerId, session),
      ]);
      const loserStreak = await this.incrementWeakStreak(loserId, session);
      if (loserStreak) weakStreaks.push(loserStreak);
    } else if (outcome === 'FLAGGED') {
      // Increment flags and atomically withdraw if threshold is crossed.
      // Does not fold into the weak-response streak — it wasn't judged.
      const [flagA, flagB] = await Promise.all([
        this.incrementFlag(responseAId, session),
        this.incrementFlag(responseBId, session),
      ]);
      // incrementFlag returns null when the response document was not found
      // (deleted between recordPick and this step); skip phantom entries.
      if (flagA) withdrawals.push(flagA);
      if (flagB) withdrawals.push(flagB);
    } else {
      // BOTH_WEAK: a substantive judgment against both sides.
      const [a, b] = await Promise.all([
        this.incrementWeakStreak(responseAId, session),
        this.incrementWeakStreak(responseBId, session),
      ]);
      if (a) weakStreaks.push(a);
      if (b) weakStreaks.push(b);
    }

    return {weakStreaks, withdrawals};
  }

  private async incrementWin(
    responseId: ObjectId,
    winsRequired: number = WINS_REQUIRED,
    session?: ClientSession,
  ): Promise<void> {
    const updated = await this.caseResponses.findOneAndUpdate(
      {_id: responseId},
      {$inc: {winCount: 1}, $set: {updatedAt: new Date()}},
      {returnDocument: 'after', session},
    );
    if (updated && updated.status === 'OPEN' && updated.winCount >= winsRequired) {
      await this.caseResponses.updateOne(
        {_id: responseId, status: 'OPEN'},
        {$set: {status: 'WON', updatedAt: new Date()}},
        {session},
      );
    }
  }

  /** Increments the flag counter for analytics. Flags never change a response's status. */
  private async incrementFlag(
    responseId: ObjectId,
    session?: ClientSession,
  ): Promise<{responseId: ObjectId; userId: ObjectId; withdrawn: boolean} | null> {
    const updated = await this.caseResponses.findOneAndUpdate(
      {_id: responseId},
      {$inc: {flagCount: 1}, $set: {updatedAt: new Date()}},
      {returnDocument: 'after', session},
    );
    // Document was deleted between recordPick and this step — skip it.
    if (!updated) return null;
    return {responseId, userId: updated.userId, withdrawn: false};
  }

  private async incrementWeakStreak(
    responseId: ObjectId,
    session?: ClientSession,
  ): Promise<{responseId: ObjectId; userId: ObjectId; weakStreak: number} | null> {
    const updated = await this.caseResponses.findOneAndUpdate(
      {_id: responseId},
      {$inc: {weakStreak: 1}, $set: {updatedAt: new Date()}},
      {returnDocument: 'after', session},
    );
    if (!updated) return null;
    return {responseId, userId: updated.userId, weakStreak: updated.weakStreak};
  }

  private async resetWeakStreak(
    responseId: ObjectId,
    session?: ClientSession,
  ): Promise<void> {
    await this.caseResponses.updateOne(
      {_id: responseId},
      {$set: {weakStreak: 0, updatedAt: new Date()}},
      {session},
    );
  }

  async incrementReviewerQuota(
    reviewerId: string,
    caseStudyId: string,
    session?: ClientSession,
  ): Promise<void> {
    await this.init();
    await this.caseReviewQuota.updateOne(
      {reviewerId: new ObjectId(reviewerId), caseStudyId: new ObjectId(caseStudyId)},
      {$inc: {validPicks: 1}},
      {upsert: true, session},
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

  /** All responses for a case study, newest first — for the instructor response viewer. */
  async listResponsesForInstructor(caseStudyId: string): Promise<ICaseResponse[]> {
    await this.init();
    return this.caseResponses
      .find({caseStudyId: new ObjectId(caseStudyId)})
      .sort({createdAt: -1})
      .toArray();
  }

  // ---------------------------------------------------------------------
  // Samagama integration roster
  // ---------------------------------------------------------------------

  /**
   * Per-learner facts for the Samagama-facing integration roster. Reports
   * `casesSubmitted`/`casesWon`/`casesInReview` only — it never computes a
   * "N of ~20 complete" boolean, since that completion rule is Samagama's to
   * apply (PLANNING.md §4.2), not ViBe's.
   *
   * Uses a single $facet pipeline to compute paged data and total count in
   * one collection pass.
   */
  async getIntegrationProgress(input: {
    courseVersionId: string;
    page: number;
    limit: number;
  }): Promise<{totalLearners: number; learners: IIntegrationLearnerProgress[]}> {
    await this.init();
    const versionObjId = new ObjectId(input.courseVersionId);
    const skip = (input.page - 1) * input.limit;

    const [result] = await this.caseResponses
      .aggregate<{
        data: Array<{
          _id: ObjectId;
          casesSubmitted: number;
          casesWon: number;
          casesInReview: number;
          lastActivityAt: Date;
        }>;
        total: Array<{count: number}>;
      }>([
        {$match: {courseVersionId: versionObjId}},
        {
          $facet: {
            data: [
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
            ],
            total: [
              {$group: {_id: '$userId'}},
              {$count: 'count'},
            ],
          },
        },
      ])
      .toArray();

    return {
      totalLearners: result?.total[0]?.count ?? 0,
      learners: (result?.data ?? []).map(r => ({
        userId: r._id.toString(),
        casesSubmitted: r.casesSubmitted,
        casesWon: r.casesWon,
        casesInReview: r.casesInReview,
        lastActivityAt: r.lastActivityAt ?? null,
      })),
    };
  }
}
