import 'reflect-metadata';
import { injectable, inject } from 'inversify';
import { ClientSession, Collection } from 'mongodb';
import { MongoDatabase } from '#shared/database/providers/mongo/MongoDatabase.js';
import { InternalServerError } from 'routing-controllers';
import { GLOBAL_TYPES } from '#root/types.js';
import { IPeerReviewSubmission } from '#shared/interfaces/models.js';

/**
 * Mongo CRUD for `peer_review_submissions` collection.
 *
 * Collection: peer_review_submissions
 * Indexes:
 *   - { assessmentId: 1, studentId: 1 } UNIQUE  (idempotency)
 *   - { assessmentId: 1 }                       (algorithm + teacher list)
 *   - { studentId: 1 }                          (student dashboard)
 *
 * Upsert semantics: the (assessmentId, studentId) unique index makes
 * upsertForStudent naturally idempotent — re-submitting just updates
 * the same row.
 */
@injectable()
export class PeerReviewSubmissionRepository {
  private collection: Collection<IPeerReviewSubmission>;

  constructor(@inject(GLOBAL_TYPES.Database) private db: MongoDatabase) {}

  private async init() {
    this.collection = await this.db.getCollection<IPeerReviewSubmission>(
      'peer_review_submissions',
    );
    await this.collection.createIndex(
      { assessmentId: 1, studentId: 1 },
      { unique: true },
    );
    await this.collection.createIndex({ assessmentId: 1 });
    await this.collection.createIndex({ studentId: 1 });
  }

  async findById(id: string): Promise<IPeerReviewSubmission | null> {
    await this.init();
    const doc = await this.collection.findOne({ _id: id as any });
    if (!doc) return null;
    return doc as IPeerReviewSubmission;
  }

  async findByAssessmentAndStudent(
    assessmentId: string,
    studentId: string,
  ): Promise<IPeerReviewSubmission | null> {
    await this.init();
    const doc = await this.collection.findOne({
      assessmentId: assessmentId as any,
      studentId: studentId as any,
    });
    if (!doc) return null;
    return doc as IPeerReviewSubmission;
  }

  async findByAssessment(
    assessmentId: string,
  ): Promise<IPeerReviewSubmission[]> {
    await this.init();
    const docs = await this.collection
      .find({ assessmentId: assessmentId as any })
      .toArray();
    return docs as IPeerReviewSubmission[];
  }

  async findByStudent(
    studentId: string,
  ): Promise<IPeerReviewSubmission[]> {
    await this.init();
    const docs = await this.collection
      .find({ studentId: studentId as any })
      .toArray();
    return docs as IPeerReviewSubmission[];
  }

  async countForAssessment(assessmentId: string): Promise<number> {
    await this.init();
    return this.collection.countDocuments({
      assessmentId: assessmentId as any,
    });
  }

  /**
   * Idempotent upsert keyed on (assessmentId, studentId).
   * Returns the document _id.
   */
  async upsertForStudent(
    assessmentId: string,
    studentId: string,
    patch: Partial<IPeerReviewSubmission>,
    session?: ClientSession,
  ): Promise<string> {
    await this.init();
    const now = new Date();
    try {
      const result = await this.collection.findOneAndUpdate(
        { assessmentId: assessmentId as any, studentId: studentId as any },
        {
          $set: { ...patch, updatedAt: now },
          $setOnInsert: {
            assessmentId,
            studentId,
            createdAt: now,
            reviewsCompleted: 0,
            reviewsTotal: 3,
            reviewAssignmentIds: [],
            teacherOverridden: false,
          },
        },
        {
          upsert: true,
          returnDocument: 'after',
          session,
        },
      );
      if (!result) {
        throw new InternalServerError(
          'upsertForStudent returned no document',
        );
      }
      return (result as any)._id.toString();
    } catch (e: any) {
      throw new InternalServerError(
        `Failed to upsert peer_review_submission: ${e.message}`,
      );
    }
  }

  async setReviewsTotal(
    id: string,
    total: number,
    session?: ClientSession,
  ): Promise<void> {
    await this.init();
    await this.collection.updateOne(
      { _id: id as any },
      { $set: { reviewsTotal: total, updatedAt: new Date() } },
      { session },
    );
  }

  async incrementReviewsCompleted(
    id: string,
    session?: ClientSession,
  ): Promise<void> {
    await this.init();
    await this.collection.updateOne(
      { _id: id as any },
      { $inc: { reviewsCompleted: 1 }, $set: { updatedAt: new Date() } },
      { session },
    );
  }

  async appendReviewAssignmentId(
    id: string,
    assignmentId: string,
    session?: ClientSession,
  ): Promise<void> {
    await this.init();
    await this.collection.updateOne(
      { _id: id as any },
      {
        $push: { reviewAssignmentIds: assignmentId as any },
        $set: { updatedAt: new Date() },
      },
      { session },
    );
  }

  async setFinalScore(
    id: string,
    totalScore: number,
    breakdown: Array<{ criterionId: string; meanScore: number; maxPoints: number }>,
    session?: ClientSession,
  ): Promise<void> {
    await this.init();
    await this.collection.updateOne(
      { _id: id as any },
      {
        $set: {
          finalScore: totalScore,
          finalScoreBreakdown: breakdown,
          finalScoreLockedAt: new Date(),
          updatedAt: new Date(),
        },
      },
      { session },
    );
  }

  /**
   * Clears the final score (used by the hard-exclude late path so the
   * teacher gets a finalScore=null submission to intervene on).
   */
  async clearFinalScore(
    id: string,
    session?: ClientSession,
  ): Promise<void> {
    await this.init();
    await this.collection.updateOne(
      { _id: id as any },
      {
        $set: {
          finalScore: null,
          finalScoreBreakdown: null,
          finalScoreLockedAt: new Date(),
          pendingTeacherIntervention: true,
          updatedAt: new Date(),
        },
      },
      { session },
    );
  }

  async setTeacherOverride(
    id: string,
    reason: string,
    session?: ClientSession,
  ): Promise<void> {
    await this.init();
    await this.collection.updateOne(
      { _id: id as any },
      {
        $set: {
          teacherOverridden: true,
          teacherOverrideReason: reason,
          updatedAt: new Date(),
        },
      },
      { session },
    );
  }
}