import 'reflect-metadata';
import { injectable, inject } from 'inversify';
import { ClientSession, Collection, ObjectId } from 'mongodb';
import { MongoDatabase } from '#shared/database/providers/mongo/MongoDatabase.js';
import { InternalServerError } from 'routing-controllers';
import { GLOBAL_TYPES } from '#root/types.js';
import { IPeerReviewAssessment } from '#shared/interfaces/models.js';

/**
 * Mongo CRUD for `peer_review_assessments` collection.
 *
 * Collection: peer_review_assessments
 * Indexes:
 *   - { itemId: 1 }                           (lookup by Item)
 *   - { courseId: 1, cohortId: 1 }            (teacher list per cohort)
 *   - { submissionDeadline: 1, assignmentRunAt: 1 }  (cron: pick due assessments)
 *
 * All public methods are safe to call multiple times — idempotent init.
 */
@injectable()
export class PeerReviewAssessmentRepository {
  private collection: Collection<IPeerReviewAssessment>;

  constructor(@inject(GLOBAL_TYPES.Database) private db: MongoDatabase) {}

  private async init() {
    this.collection = await this.db.getCollection<IPeerReviewAssessment>(
      'peer_review_assessments',
    );
    await this.collection.createIndex({ itemId: 1 });
    await this.collection.createIndex({ courseId: 1, cohortId: 1 });
    await this.collection.createIndex({
      submissionDeadline: 1,
      assignmentRunAt: 1,
    });
  }

  async findById(id: string): Promise<IPeerReviewAssessment | null> {
    await this.init();
    // _id is stored as ObjectId; coerce the incoming string so the
    // query matches (matching the pattern used by findByItemId /
    // findByCourseVersion).
    const filter = (() => {
      try {
        return { _id: new ObjectId(id) as any };
      } catch (_) {
        return { _id: id as any };
      }
    })();
    const doc = await this.collection.findOne(filter);
    if (!doc) return null;
    return doc as IPeerReviewAssessment;
  }

  async findByItemId(itemId: string): Promise<IPeerReviewAssessment | null> {
    await this.init();
    // itemId in mongo is stored as ObjectId; coerce the incoming string so
    // the query matches.
    const filter = (() => {
      try {
        return { itemId: new ObjectId(itemId) as any };
      } catch (_) {
        return { itemId: itemId as any };
      }
    })();
    const doc = await this.collection.findOne(filter);
    if (!doc) return null;
    return doc as IPeerReviewAssessment;
  }

  /**
   * Bulk lookup: every assessment in a course/version (optionally
   * narrowed to one cohort). Used by the submission-summary endpoint.
   */
  async findByCourseVersion(
    courseId: string,
    courseVersionId: string,
    cohortId?: string,
  ): Promise<IPeerReviewAssessment[]> {
    await this.init();
    const filter: any = {
      courseId: typeof courseId === 'string' ? new ObjectId(courseId) as any : courseId,
      courseVersionId: typeof courseVersionId === 'string' ? new ObjectId(courseVersionId) as any : courseVersionId,
      isDeleted: { $ne: true },
    };
    if (cohortId) {
      filter.cohortId = typeof cohortId === 'string' ? new ObjectId(cohortId) as any : cohortId;
    }
    const docs = await this.collection.find(filter).toArray();
    return docs as IPeerReviewAssessment[];
  }

  async findActiveByCourse(
    courseId: string,
  ): Promise<IPeerReviewAssessment[]> {
    await this.init();
    // courseId is stored as ObjectId; coerce to match query intent.
    const cId: any = (() => {
      try {
        return new ObjectId(courseId);
      } catch (_) {
        return courseId;
      }
    })();
    const docs = await this.collection
      .find({ courseId: cId, isDeleted: { $ne: true } })
      .toArray();
    return docs as IPeerReviewAssessment[];
  }

  /**
   * Cron query: assessments whose submissionDeadline has passed AND the
   * assignment algorithm hasn't run yet for them.
   */
  async findDueForAssignment(
    now: Date,
  ): Promise<IPeerReviewAssessment[]> {
    await this.init();
    const docs = await this.collection
      .find({
        submissionDeadline: { $lte: now },
        assignmentRunAt: { $exists: false },
        isDeleted: { $ne: true },
      })
      .toArray();
    return docs as IPeerReviewAssessment[];
  }

  /**
   * Cron query: assessments whose reviewDeadline has passed AND the
   * assignment algorithm HAS run (so there are reviews to score).
   * Idempotent: if closedAt is already set we still return — the runner
   * is responsible for skipping already-finalized rows (checked via
   * submission.finalScoreLockedAt).
   */
  async findDueForFinalization(
    now: Date,
  ): Promise<IPeerReviewAssessment[]> {
    await this.init();
    const docs = await this.collection
      .find({
        reviewDeadline: { $lte: now },
        assignmentRunAt: { $exists: true },
        isDeleted: { $ne: true },
      })
      .toArray();
    return docs as IPeerReviewAssessment[];
  }

  async create(
    doc: IPeerReviewAssessment,
    session?: ClientSession,
  ): Promise<string> {
    await this.init();
    if (!doc.createdAt) doc.createdAt = new Date();
    doc.updatedAt = new Date();
    if (doc.isDeleted === undefined) doc.isDeleted = false;
    try {
      const result = await this.collection.insertOne(doc, { session });
      return result.insertedId.toString();
    } catch (e: any) {
      throw new InternalServerError(
        `Failed to create peer_review_assessment: ${e.message}`,
      );
    }
  }

  async update(
    id: string,
    patch: Partial<IPeerReviewAssessment>,
    session?: ClientSession,
  ): Promise<void> {
    await this.init();
    patch.updatedAt = new Date();
    const filter = ObjectId.isValid(id)
      ? { _id: new ObjectId(id) as any }
      : { _id: id as any };
    await this.collection.updateOne(
      filter,
      { $set: patch },
      { session },
    );
  }

  async softDelete(
    id: string,
    session?: ClientSession,
  ): Promise<void> {
    await this.init();
    const filter = ObjectId.isValid(id)
      ? { _id: new ObjectId(id) as any }
      : { _id: id as any };
    await this.collection.updateOne(
      filter,
      { $set: { isDeleted: true, deletedAt: new Date(), updatedAt: new Date() } },
      { session },
    );
  }

  async setAssignmentRunAt(
    id: string,
    when: Date,
    session?: ClientSession,
  ): Promise<void> {
    await this.init();
    const filter = (() => {
      try {
        return { _id: new ObjectId(id) as any };
      } catch (_) {
        return { _id: id as any };
      }
    })();
    await this.collection.updateOne(
      filter,
      { $set: { assignmentRunAt: when, updatedAt: new Date() } },
      { session },
    );
  }

  async setClosed(
    id: string,
    when: Date,
    session?: ClientSession,
  ): Promise<void> {
    await this.init();
    const filter = (() => {
      try {
        return { _id: new ObjectId(id) as any };
      } catch (_) {
        return { _id: id as any };
      }
    })();
    await this.collection.updateOne(
      filter,
      { $set: { closedAt: when, updatedAt: new Date() } },
      { session },
    );
  }
}