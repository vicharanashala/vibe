import 'reflect-metadata';
import { injectable, inject } from 'inversify';
import { ClientSession, Collection, ObjectId } from 'mongodb';
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
    const filter = ObjectId.isValid(id)
      ? { _id: new ObjectId(id) as any }
      : { _id: id as any };
    const doc = await this.collection.findOne(filter);
    if (!doc) return null;
    return doc as IPeerReviewSubmission;
  }

  async findByAssessmentAndStudent(
    assessmentId: string,
    studentId: string,
  ): Promise<IPeerReviewSubmission | null> {
    await this.init();
    // assessmentId is stored as an ObjectId in mongo; the URL
    // passes it as a string, so coerce here. studentId stays a
    // string — it's stored as a plain string.
    const filter: any = { studentId: studentId as any };
    if (ObjectId.isValid(assessmentId)) {
      filter.assessmentId = new ObjectId(assessmentId);
    } else {
      filter.assessmentId = assessmentId as any;
    }
    const doc = await this.collection.findOne(filter);
    if (!doc) return null;
    return doc as IPeerReviewSubmission;
  }

  async findByAssessment(
    assessmentId: string,
  ): Promise<IPeerReviewSubmission[]> {
    await this.init();
    // assessmentId is stored as an ObjectId on every submission; the
    // HTTP layer passes a 24-hex string, so coerce here. Without this,
    // queries silently return [] and the assignment algorithm short-
    // circuits to `insufficient_submissions` (because submissions.length
    // === 0), and assignmentRunAt gets stamped on a phantom
    // "ran" — never inserting any actual reviewer pairs.
    const filter: any = {};
    if (ObjectId.isValid(assessmentId)) {
      filter.assessmentId = new ObjectId(assessmentId);
    } else {
      filter.assessmentId = assessmentId;
    }
    const docs = await this.collection.find(filter).toArray();
    return docs as IPeerReviewSubmission[];
  }

  /**
   * Bulk lookup: this student's submissions across many assessments.
   * Used by the submission-summary endpoint.
   */
  async findByStudentAndAssessmentIds(
    studentId: string,
    assessmentIds: string[],
  ): Promise<IPeerReviewSubmission[]> {
    await this.init();
    if (!assessmentIds || assessmentIds.length === 0) return [];
    // Coerce each id to ObjectId where possible.
    const orClauses = assessmentIds.flatMap((id) => {
      if (typeof id !== 'string') return [{ assessmentId: id as any }];
      if (ObjectId.isValid(id)) return [
        { assessmentId: new ObjectId(id) as any },
        { assessmentId: id as any }, // also try as raw string in case it was stored that way
      ];
      return [{ assessmentId: id as any }];
    });
    const docs = await this.collection
      .find({ studentId: studentId as any, $or: orClauses })
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
    // Strip fields that the upsert already controls: don't let the
    // patch shadow the filter's compound key, and don't try to mutate
    // a field that's in $setOnInsert. MongoDB rejects "Updating the
    // path 'X' would create a conflict at 'X'" on unique-indexed
    // fields, so studentId/assessmentId/createdAt must stay out of
    // the $set.
    const { studentId: _omitStudentId, assessmentId: _omitAssessmentId, createdAt: _omitCreatedAt, ...safePatch } =
      patch as any;
    void _omitStudentId;
    void _omitAssessmentId;
    void _omitCreatedAt;
    const queryAssessmentId = ObjectId.isValid(assessmentId)
      ? new ObjectId(assessmentId)
      : assessmentId;
    try {
      const result = await this.collection.findOneAndUpdate(
        { assessmentId: queryAssessmentId as any, studentId: studentId as any },
        {
          $set: { ...safePatch, updatedAt: now },
          $setOnInsert: {
            assessmentId: queryAssessmentId as any,
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
    const filter = ObjectId.isValid(id)
      ? { _id: new ObjectId(id) as any }
      : { _id: id as any };
    await this.collection.updateOne(
      filter,
      { $set: { reviewsTotal: total, updatedAt: new Date() } },
      { session },
    );
  }

  async incrementReviewsCompleted(
    id: string,
    session?: ClientSession,
  ): Promise<void> {
    await this.init();
    const filter = ObjectId.isValid(id)
      ? { _id: new ObjectId(id) as any }
      : { _id: id as any };
    await this.collection.updateOne(
      filter,
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
    // submissions._id is an ObjectId in mongo; the assignmentId we push
    // is also an ObjectId string (from createMany). Coerce both, otherwise
    // the updateOne filter silently matches 0 docs and reviewAssignmentIds
    // stays empty.
    const filter = ObjectId.isValid(id)
      ? { _id: new ObjectId(id) as any }
      : { _id: id as any };
    await this.collection.updateOne(
      filter,
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
    const filter = ObjectId.isValid(id)
      ? { _id: new ObjectId(id) as any }
      : { _id: id as any };
    await this.collection.updateOne(
      filter,
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
    const filter = ObjectId.isValid(id)
      ? { _id: new ObjectId(id) as any }
      : { _id: id as any };
    await this.collection.updateOne(
      filter,
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
    const filter = ObjectId.isValid(id)
      ? { _id: new ObjectId(id) as any }
      : { _id: id as any };
    await this.collection.updateOne(
      filter,
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