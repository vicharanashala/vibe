import 'reflect-metadata';
import {Collection, ObjectId} from 'mongodb';
import {inject, injectable} from 'inversify';
import {MongoDatabase} from '#shared/database/providers/mongo/MongoDatabase.js';
import {GLOBAL_TYPES} from '#root/types.js';
import {
  IReflection,
  IReflectionReview,
  IReflectionScores,
  Reflection,
  averageOfScores,
} from '../../../classes/transformers/Reflection.js';
import {
  ReflectionPolicy,
  resolvePolicy,
} from '../../../constants.js';

/** Aggregate counters for one section, used by the instructor view. */
export interface ISectionReflectionStats {
  reflectionCount: number;
  reviewCount: number;
  /** Reflections that have reached MIN_REVIEWS_TO_REVEAL or more. */
  scoredCount: number;
  /** Mean peer score across every scored reflection, or null if none. */
  averageScore: number | null;
  /** Mean self-rated confidence across all reflections, or null if none. */
  averageConfidence: number | null;
}

@injectable()
export class ReflectionRepository {
  private reflections!: Collection<IReflection>;
  private reviews!: Collection<IReflectionReview>;
  /** The REFLECTION item documents, read only for their instructor policy. */
  private items!: Collection<{_id: ObjectId; details?: Partial<ReflectionPolicy>}>;
  private initialized = false;

  constructor(@inject(GLOBAL_TYPES.Database) private db: MongoDatabase) {}

  private async init(): Promise<void> {
    if (this.initialized) return;
    this.reflections = await this.db.getCollection<IReflection>('reflections');
    this.reviews = await this.db.getCollection<IReflectionReview>(
      'reflectionReviews',
    );
    this.items = await this.db.getCollection<{
      _id: ObjectId;
      details?: Partial<ReflectionPolicy>;
    }>('reflection_items');
    this.initialized = true;

    try {
      // One reflection per student per section.
      await this.reflections.createIndex(
        {userId: 1, itemId: 1},
        {unique: true, background: true},
      );
      // Serving pool: open reflections for a section, fewest reviews first.
      await this.reflections.createIndex(
        {itemId: 1, status: 1, reviewCount: 1},
        {background: true},
      );
      // Instructor listings.
      await this.reflections.createIndex(
        {courseVersionId: 1, itemId: 1, createdAt: -1},
        {background: true},
      );
      // A peer may review a given reflection at most once.
      await this.reviews.createIndex(
        {reflectionId: 1, reviewerId: 1},
        {unique: true, background: true},
      );
      // Counting a reviewer's completed reviews for a section (unlock check).
      await this.reviews.createIndex(
        {reviewerId: 1, itemId: 1},
        {background: true},
      );
    } catch {
      // Indexes already exist.
    }
  }

  /**
   * The instructor policy configured on a reflection item, falling back to the
   * defaults when the item is missing or carries no overrides.
   *
   * Read straight from the item collection rather than through the courses
   * module, which keeps peerReviews free of a cross-module binding for what is
   * a three-field lookup.
   */
  async getPolicy(itemId: string): Promise<ReflectionPolicy> {
    await this.init();
    const item = await this.items.findOne(
      {_id: new ObjectId(itemId)},
      {projection: {details: 1}},
    );
    return resolvePolicy(item?.details);
  }

  async create(reflection: Reflection): Promise<string> {
    await this.init();
    const result = await this.reflections.insertOne(reflection);
    return result.insertedId.toString();
  }

  async findById(reflectionId: string): Promise<IReflection | null> {
    await this.init();
    return this.reflections.findOne({
      _id: new ObjectId(reflectionId),
      isDeleted: {$ne: true},
    });
  }

  /** The caller's own reflection for a section, if they have written one. */
  async findByUserAndItem(
    userId: string,
    itemId: string,
  ): Promise<IReflection | null> {
    await this.init();
    return this.reflections.findOne({
      userId: new ObjectId(userId),
      itemId: new ObjectId(itemId),
      isDeleted: {$ne: true},
    });
  }

  /**
   * Next reflection this user should review for a section, or null when the
   * pool is exhausted.
   *
   * Pull-based by design: nothing is pre-assigned, so a reviewer who never
   * returns leaves no orphaned slot. Sorting by fewest reviews first spreads
   * coverage evenly instead of piling reviews onto whatever was submitted
   * earliest, which is what keeps most reflections above the reveal threshold.
   */
  async findNextForReview(input: {
    reviewerId: string;
    itemId: string;
    maxReviewsPerReflection: number;
  }): Promise<IReflection | null> {
    await this.init();
    const reviewedIds = await this.listReviewedReflectionIds(
      input.reviewerId,
      input.itemId,
    );
    return this.reflections.findOne(
      {
        itemId: new ObjectId(input.itemId),
        status: 'OPEN',
        isDeleted: {$ne: true},
        userId: {$ne: new ObjectId(input.reviewerId)},
        reviewCount: {$lt: input.maxReviewsPerReflection},
        ...(reviewedIds.length > 0
          ? {_id: {$nin: reviewedIds.map(id => new ObjectId(id))}}
          : {}),
      },
      {sort: {reviewCount: 1, createdAt: 1}},
    );
  }

  /** Reflection ids in a section this reviewer has already scored. */
  async listReviewedReflectionIds(
    reviewerId: string,
    itemId: string,
  ): Promise<string[]> {
    await this.init();
    const docs = await this.reviews
      .find(
        {
          reviewerId: new ObjectId(reviewerId),
          itemId: new ObjectId(itemId),
        },
        {projection: {reflectionId: 1}},
      )
      .toArray();
    return docs.map(d => d.reflectionId.toString());
  }

  /** How many reviews this user has completed for a section. */
  async countReviewsByReviewer(
    reviewerId: string,
    itemId: string,
  ): Promise<number> {
    await this.init();
    return this.reviews.countDocuments({
      reviewerId: new ObjectId(reviewerId),
      itemId: new ObjectId(itemId),
    });
  }

  /**
   * Persist one peer review and fold it into the reflection's aggregates.
   *
   * Ordering matters. The review is inserted first so the unique index is the
   * single source of truth for "already reviewed" — two concurrent submissions
   * cannot both win. The counter update is then guarded on the reflection still
   * being open and under the cap; if that guard fails the review is removed
   * again, leaving no half-applied state and letting the caller serve a
   * different reflection.
   *
   * Returns null when the reviewer has already reviewed this reflection, and
   * `{capped: true}` when the reflection filled up in the meantime.
   */
  async recordReview(input: {
    reflectionId: string;
    reviewerId: string;
    courseVersionId: string;
    itemId: string;
    scores: IReflectionScores;
    helpful: boolean;
    maxReviewsPerReflection: number;
  }): Promise<
    {applied: true; reviewCount: number} | {applied: false; reason: 'DUPLICATE' | 'CAPPED'}
  > {
    await this.init();
    const reflectionId = new ObjectId(input.reflectionId);
    const averageScore = averageOfScores(input.scores);

    let insertedId: ObjectId;
    try {
      const inserted = await this.reviews.insertOne({
        reflectionId,
        reviewerId: new ObjectId(input.reviewerId),
        courseVersionId: new ObjectId(input.courseVersionId),
        itemId: new ObjectId(input.itemId),
        scores: input.scores,
        averageScore,
        helpful: input.helpful,
        createdAt: new Date(),
      });
      insertedId = inserted.insertedId;
    } catch (e: any) {
      if (e?.code === 11000) return {applied: false, reason: 'DUPLICATE'};
      throw e;
    }

    const updated = await this.reflections.findOneAndUpdate(
      {
        _id: reflectionId,
        status: 'OPEN',
        reviewCount: {$lt: input.maxReviewsPerReflection},
      },
      {
        $inc: {
          reviewCount: 1,
          scoreSum: averageScore,
          helpfulCount: input.helpful ? 1 : 0,
        },
        $set: {updatedAt: new Date()},
      },
      {returnDocument: 'after'},
    );

    if (!updated) {
      await this.reviews.deleteOne({_id: insertedId});
      return {applied: false, reason: 'CAPPED'};
    }

    // Close the reflection once it is full so it stops appearing in the pool.
    if (updated.reviewCount >= input.maxReviewsPerReflection) {
      await this.reflections.updateOne(
        {_id: reflectionId, status: 'OPEN'},
        {$set: {status: 'CLOSED', updatedAt: new Date()}},
      );
    }

    return {applied: true, reviewCount: updated.reviewCount};
  }

  /** Instructor listing for one course version, optionally narrowed to a section. */
  async listByCourseVersion(input: {
    courseVersionId: string;
    itemId?: string;
    limit: number;
  }): Promise<IReflection[]> {
    await this.init();
    return this.reflections
      .find({
        courseVersionId: new ObjectId(input.courseVersionId),
        ...(input.itemId ? {itemId: new ObjectId(input.itemId)} : {}),
        isDeleted: {$ne: true},
      })
      .sort({createdAt: -1})
      .limit(input.limit)
      .toArray();
  }

  /** Rolled-up counters for the instructor view. */
  async getStats(input: {
    courseVersionId: string;
    itemId?: string;
    minReviewsToReveal: number;
  }): Promise<ISectionReflectionStats> {
    await this.init();
    const match = {
      courseVersionId: new ObjectId(input.courseVersionId),
      ...(input.itemId ? {itemId: new ObjectId(input.itemId)} : {}),
      isDeleted: {$ne: true},
    };

    const [row] = await this.reflections
      .aggregate<{
        reflectionCount: number;
        reviewCount: number;
        scoredCount: number;
        scoreSum: number;
        confidenceSum: number;
      }>([
        {$match: match},
        {
          $group: {
            _id: null,
            reflectionCount: {$sum: 1},
            reviewCount: {$sum: '$reviewCount'},
            confidenceSum: {$sum: '$confidence'},
            scoredCount: {
              $sum: {
                $cond: [
                  {$gte: ['$reviewCount', input.minReviewsToReveal]},
                  1,
                  0,
                ],
              },
            },
            scoreSum: {
              $sum: {
                $cond: [
                  {$gte: ['$reviewCount', input.minReviewsToReveal]},
                  {$divide: ['$scoreSum', {$max: ['$reviewCount', 1]}]},
                  0,
                ],
              },
            },
          },
        },
      ])
      .toArray();

    if (!row || row.reflectionCount === 0) {
      return {
        reflectionCount: 0,
        reviewCount: 0,
        scoredCount: 0,
        averageScore: null,
        averageConfidence: null,
      };
    }

    return {
      reflectionCount: row.reflectionCount,
      reviewCount: row.reviewCount,
      scoredCount: row.scoredCount,
      averageScore:
        row.scoredCount > 0
          ? Math.round((row.scoreSum / row.scoredCount) * 100) / 100
          : null,
      averageConfidence:
        Math.round((row.confidenceSum / row.reflectionCount) * 100) / 100,
    };
  }
}
