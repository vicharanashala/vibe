import 'reflect-metadata';
import { injectable, inject } from 'inversify';
import { ClientSession, Collection, ObjectId } from 'mongodb';
import { MongoDatabase } from '#shared/database/providers/mongo/MongoDatabase.js';
import { InternalServerError } from 'routing-controllers';
import { GLOBAL_TYPES } from '#root/types.js';
import { IPeerReviewReview } from '#shared/interfaces/models.js';

/**
 * Repository for peer_review_reviews.
 *
 * Every method that accepts an ID accepts either a 24-char hex Mongo
 * ObjectId string OR an existing ObjectId instance. Strings are coerced
 * to ObjectId for the Mongo query so calls from controllers (which get
 * hex strings from URL params) match the actual ObjectId-stored docs.
 */
@injectable()
export class PeerReviewReviewRepository {
  private readonly collectionName = 'peer_review_reviews';
  private collection: Collection<IPeerReviewReview>;

  constructor(
    @inject(GLOBAL_TYPES.Database)
    private readonly database: MongoDatabase,
  ) {}

  private async init(): Promise<void> {
    if (!this.collection) {
      this.collection = await this.database.getCollection<IPeerReviewReview>(
        this.collectionName,
      );
    }
  }

  async create(
    doc: IPeerReviewReview,
    session?: ClientSession,
  ): Promise<string> {
    await this.init();
    const now = new Date();
    (doc as any).createdAt = (doc as any).createdAt ?? now;
    (doc as any).updatedAt = now;
    const result = await this.collection.insertOne(doc, { session });
    if (!result.insertedId) {
      throw new InternalServerError('Failed to insert review');
    }
    return result.insertedId.toString();
  }

  async findById(id: string): Promise<IPeerReviewReview | null> {
    await this.init();
    const filter: any = {};
    if (typeof id === 'string' && /^[0-9a-fA-F]{24}$/.test(id)) {
      filter._id = new ObjectId(id);
    } else {
      filter._id = id as any;
    }
    const doc = await this.collection.findOne(filter);
    if (!doc) return null;
    return doc as IPeerReviewReview;
  }

  async findByAssessment(
    assessmentId: string,
  ): Promise<IPeerReviewReview[]> {
    await this.init();
    const filter: any = {};
    if (typeof assessmentId === 'string' && /^[0-9a-fA-F]{24}$/.test(assessmentId)) {
      filter.assessmentId = new ObjectId(assessmentId);
    } else {
      filter.assessmentId = assessmentId as any;
    }
    const docs = await this.collection
      .find(filter)
      .toArray();
    return docs as IPeerReviewReview[];
  }

  async findBySubmission(
    submissionId: string,
  ): Promise<IPeerReviewReview[]> {
    await this.init();
    const filter: any = {};
    if (typeof submissionId === 'string' && /^[0-9a-fA-F]{24}$/.test(submissionId)) {
      filter.submissionId = new ObjectId(submissionId);
    } else {
      filter.submissionId = submissionId as any;
    }
    const docs = await this.collection
      .find(filter)
      .toArray();
    return docs as IPeerReviewReview[];
  }

  async findByReviewer(
    assessmentId: string,
    reviewerId: string,
  ): Promise<IPeerReviewReview[]> {
    await this.init();
    const filter: any = {};
    if (typeof assessmentId === 'string' && /^[0-9a-fA-F]{24}$/.test(assessmentId)) {
      filter.assessmentId = new ObjectId(assessmentId);
    } else {
      filter.assessmentId = assessmentId as any;
    }
    if (typeof reviewerId === 'string' && /^[0-9a-fA-F]{24}$/.test(reviewerId)) {
      filter.reviewerId = new ObjectId(reviewerId);
    } else {
      filter.reviewerId = reviewerId as any;
    }
    const docs = await this.collection
      .find(filter)
      .toArray();
    return docs as IPeerReviewReview[];
  }

  /**
   * Apply a teacher override. Sets the override flag, swap scores with the
   * teacherOverrideScores, stamp the audit fields. Caller is responsible
   * for recomputing the affected submission's finalScore.
   */
  async applyTeacherOverride(
    id: string,
    args: {
      teacherOverrideScores: Array<{
        criterionId: string;
        score: number;
        comment: string;
      }>;
      overallComment?: string;
      reason: string;
      overriddenBy: string;
    },
    session?: ClientSession,
  ): Promise<void> {
    await this.init();
    const filter: any = {};
    if (typeof id === 'string' && /^[0-9a-fA-F]{24}$/.test(id)) {
      filter._id = new ObjectId(id);
    } else {
      filter._id = id as any;
    }
    const now = new Date();
    await this.collection.updateOne(
      filter,
      {
        $set: {
          teacherOverridden: true,
          teacherOverrideScores: args.teacherOverrideScores,
          teacherOverrideReason: args.reason,
          teacherOverrideBy: args.overriddenBy,
          teacherOverrideAt: now,
          updatedAt: now,
          // Optional: also override overallComment if provided
          ...(args.overallComment !== undefined
            ? { overallComment: args.overallComment }
            : {}),
        },
      },
      { session },
    );
  }
}