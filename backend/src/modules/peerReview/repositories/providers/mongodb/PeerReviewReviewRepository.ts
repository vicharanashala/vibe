import 'reflect-metadata';
import { injectable, inject } from 'inversify';
import { ClientSession, Collection } from 'mongodb';
import { MongoDatabase } from '#shared/database/providers/mongo/MongoDatabase.js';
import { InternalServerError } from 'routing-controllers';
import { GLOBAL_TYPES } from '#root/types.js';
import { IPeerReviewReview } from '#shared/interfaces/models.js';

/**
 * Mongo CRUD for `peer_reviews` collection (one row per submitted review).
 *
 * Collection: peer_reviews
 * Indexes:
 *   - { assignmentId: 1 } UNIQUE               (one review per assignment)
 *   - { submissionId: 1 }                      (score-computation + teacher audit)
 *   - { assessmentId: 1, reviewerId: 1 }       (per-reviewer dashboard)
 */
@injectable()
export class PeerReviewReviewRepository {
  private collection: Collection<IPeerReviewReview>;

  constructor(@inject(GLOBAL_TYPES.Database) private db: MongoDatabase) {}

  private async init() {
    this.collection = await this.db.getCollection<IPeerReviewReview>(
      'peer_reviews',
    );
    await this.collection.createIndex(
      { assignmentId: 1 },
      { unique: true },
    );
    await this.collection.createIndex({ submissionId: 1 });
    await this.collection.createIndex({ assessmentId: 1, reviewerId: 1 });
  }

  async create(
    doc: IPeerReviewReview,
    session?: ClientSession,
  ): Promise<string> {
    await this.init();
    if (!doc.submittedAt) doc.submittedAt = new Date();
    if (doc.teacherOverridden === undefined) doc.teacherOverridden = false;
    if (doc.isLate === undefined) doc.isLate = false;
    try {
      const result = await this.collection.insertOne(doc, { session });
      return result.insertedId.toString();
    } catch (e: any) {
      throw new InternalServerError(
        `Failed to create peer_review: ${e.message}`,
      );
    }
  }

  async findById(id: string): Promise<IPeerReviewReview | null> {
    await this.init();
    const doc = await this.collection.findOne({ _id: id as any });
    if (!doc) return null;
    return doc as IPeerReviewReview;
  }

  async findByAssignment(
    assignmentId: string,
  ): Promise<IPeerReviewReview | null> {
    await this.init();
    const doc = await this.collection.findOne({
      assignmentId: assignmentId as any,
    });
    if (!doc) return null;
    return doc as IPeerReviewReview;
  }

  async findBySubmission(
    submissionId: string,
  ): Promise<IPeerReviewReview[]> {
    await this.init();
    const docs = await this.collection
      .find({ submissionId: submissionId as any })
      .toArray();
    return docs as IPeerReviewReview[];
  }

  async findByReviewer(
    assessmentId: string,
    reviewerId: string,
  ): Promise<IPeerReviewReview[]> {
    await this.init();
    const docs = await this.collection
      .find({
        assessmentId: assessmentId as any,
        reviewerId: reviewerId as any,
      })
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
    await this.collection.updateOne(
      { _id: id as any },
      {
        $set: {
          teacherOverridden: true,
          teacherOverrideScores: args.teacherOverrideScores,
          ...(args.overallComment !== undefined
            ? { overallComment: args.overallComment }
            : {}),
          teacherOverrideReason: args.reason,
          teacherOverrideAt: new Date(),
          teacherOverrideBy: args.overriddenBy as any,
        },
      },
      { session },
    );
  }
}