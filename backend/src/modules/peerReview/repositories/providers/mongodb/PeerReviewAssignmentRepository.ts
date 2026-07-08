import 'reflect-metadata';
import { injectable, inject } from 'inversify';
import { ClientSession, Collection } from 'mongodb';
import { MongoDatabase } from '#shared/database/providers/mongo/MongoDatabase.js';
import { InternalServerError } from 'routing-controllers';
import { GLOBAL_TYPES } from '#root/types.js';
import { IPeerReviewAssignment } from '#shared/interfaces/models.js';

/**
 * Mongo CRUD for `peer_review_assignments` collection.
 *
 * Collection: peer_review_assignments
 * Indexes:
 *   - { assessmentId: 1, reviewerId: 1 }       (reviewer dashboard query)
 *   - { submissionId: 1 }                      (per-submission audit + reassign)
 *   - { assessmentId: 1, status: 1 }           (cron: pick overdue/PENDING)
 *
 * The (assessmentId, submissionId, reviewerId) tuple is logically unique
 * (no student reviews the same submission twice in one round). We don't
 * enforce a strict unique index because reassignments may produce a new
 * assignment with the same reviewer → submission pair after the original
 * was marked REASSIGNED. Application-level guard via findByExisting().
 */
@injectable()
export class PeerReviewAssignmentRepository {
  private collection: Collection<IPeerReviewAssignment>;

  constructor(@inject(GLOBAL_TYPES.Database) private db: MongoDatabase) {}

  private async init() {
    this.collection = await this.db.getCollection<IPeerReviewAssignment>(
      'peer_review_assignments',
    );
    await this.collection.createIndex({ assessmentId: 1, reviewerId: 1 });
    await this.collection.createIndex({ submissionId: 1 });
    await this.collection.createIndex({ assessmentId: 1, status: 1 });
  }

  async create(
    doc: IPeerReviewAssignment,
    session?: ClientSession,
  ): Promise<string> {
    await this.init();
    if (!doc.createdAt) doc.createdAt = new Date();
    doc.updatedAt = new Date();
    if (doc.status === undefined) doc.status = 'PENDING';
    if (doc.reassignmentCount === undefined) doc.reassignmentCount = 0;
    try {
      const result = await this.collection.insertOne(doc, { session });
      return result.insertedId.toString();
    } catch (e: any) {
      throw new InternalServerError(
        `Failed to create peer_review_assignment: ${e.message}`,
      );
    }
  }

  /**
   * Bulk insert for the assignment algorithm. Each assignment must already
   * have _id omitted (Mongo assigns it). Returns the inserted _id strings
   * in insertion order.
   */
  async createMany(
    docs: IPeerReviewAssignment[],
    session?: ClientSession,
  ): Promise<string[]> {
    await this.init();
    const now = new Date();
    for (const d of docs) {
      if (!d.createdAt) d.createdAt = now;
      d.updatedAt = now;
      if (d.status === undefined) d.status = 'PENDING';
      if (d.reassignmentCount === undefined) d.reassignmentCount = 0;
    }
    try {
      const result = await this.collection.insertMany(docs, { session });
      return Object.values(result.insertedIds).map(id => id.toString());
    } catch (e: any) {
      throw new InternalServerError(
        `Failed bulk-insert peer_review_assignments: ${e.message}`,
      );
    }
  }

  async findById(id: string): Promise<IPeerReviewAssignment | null> {
    await this.init();
    const doc = await this.collection.findOne({ _id: id as any });
    if (!doc) return null;
    return doc as IPeerReviewAssignment;
  }

  async findBySubmission(
    submissionId: string,
  ): Promise<IPeerReviewAssignment[]> {
    await this.init();
    const docs = await this.collection
      .find({ submissionId: submissionId as any })
      .toArray();
    return docs as IPeerReviewAssignment[];
  }

  async findPendingForReviewer(
    reviewerId: string,
  ): Promise<IPeerReviewAssignment[]> {
    await this.init();
    const docs = await this.collection
      .find({
        reviewerId: reviewerId as any,
        status: { $in: ['PENDING', 'IN_PROGRESS', 'OVERDUE'] },
      })
      .toArray();
    return docs as IPeerReviewAssignment[];
  }

  async findByReviewer(
    reviewerId: string,
  ): Promise<IPeerReviewAssignment[]> {
    await this.init();
    const docs = await this.collection
      .find({ reviewerId: reviewerId as any })
      .toArray();
    return docs as IPeerReviewAssignment[];
  }

  /**
   * Find every assignment for a given assessment. Used by the
   * AssignmentRunner cron to fan out the per-reviewer
   * notifyAssignmentsOut call.
   */
  async findByAssessment(
    assessmentId: string,
  ): Promise<IPeerReviewAssignment[]> {
    await this.init();
    const docs = await this.collection
      .find({ assessmentId: assessmentId as any })
      .toArray();
    return docs as IPeerReviewAssignment[];
  }

  async setStatus(
    id: string,
    status: IPeerReviewAssignment['status'],
    session?: ClientSession,
  ): Promise<void> {
    await this.init();
    await this.collection.updateOne(
      { _id: id as any },
      { $set: { status, updatedAt: new Date() } },
      { session },
    );
  }

  async setSubmittedReviewId(
    id: string,
    reviewId: string,
    session?: ClientSession,
  ): Promise<void> {
    await this.init();
    await this.collection.updateOne(
      { _id: id as any },
      {
        $set: {
          submittedReviewId: reviewId as any,
          status: 'SUBMITTED' as const,
          updatedAt: new Date(),
        },
      },
      { session },
    );
  }

  /**
   * Mark an assignment REASSIGNED, point it at the new assignment that took
   * the slot, and bump the reassignment count (used by the cap check).
   */
  async markReassigned(
    oldId: string,
    newAssignmentId: string,
    session?: ClientSession,
  ): Promise<void> {
    await this.init();
    await this.collection.updateOne(
      { _id: oldId as any },
      {
        $set: {
          status: 'REASSIGNED' as const,
          reassignedToAssignmentId: newAssignmentId as any,
          updatedAt: new Date(),
        },
      },
      { session },
    );
  }

  async incrementReassignmentCount(
    id: string,
    session?: ClientSession,
  ): Promise<void> {
    await this.init();
    await this.collection.updateOne(
      { _id: id as any },
      {
        $inc: { reassignmentCount: 1 },
        $set: { updatedAt: new Date() },
      },
      { session },
    );
  }

  /**
   * Cron query: assignments that are overdue and still under the reassign
   * cap. Used by ReassignmentRunner.
   */
  async findOverdueForReassessment(
    assessmentId: string,
    maxRounds: number,
  ): Promise<IPeerReviewAssignment[]> {
    await this.init();
    const docs = await this.collection
      .find({
        assessmentId: assessmentId as any,
        status: { $in: ['PENDING', 'OVERDUE', 'LINK_REVOKED'] },
        reassignmentCount: { $lt: maxRounds },
      })
      .toArray();
    return docs as IPeerReviewAssignment[];
  }
}