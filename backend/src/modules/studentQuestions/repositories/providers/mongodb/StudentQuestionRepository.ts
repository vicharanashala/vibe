import 'reflect-metadata';
import {Collection, ObjectId, ClientSession} from 'mongodb';
import {injectable, inject} from 'inversify';
import {MongoDatabase} from '#shared/database/providers/mongo/MongoDatabase.js';
import {GLOBAL_TYPES} from '#root/types.js';
import {
  IStudentSegmentQuestion,
  StudentQuestionStatus,
  StudentSegmentQuestion,
} from '../../../classes/transformers/StudentSegmentQuestion.js';

/** One student's ungraded response to a peer (crowd) question. */
export interface IStudentCrowdResponse {
  _id?: ObjectId;
  studentQuestionId: ObjectId;
  userId: ObjectId;
  isCorrect: boolean;
  thumb?: 'UP' | 'DOWN';
  createdAt: Date;
}

@injectable()
export class StudentQuestionRepository {
  private collection!: Collection<IStudentSegmentQuestion>;
  private responsesCollection!: Collection<IStudentCrowdResponse>;
  private initialized = false;

  constructor(@inject(GLOBAL_TYPES.Database) private db: MongoDatabase) {}

  private async init() {
    if (this.initialized) return;
    this.collection = await this.db.getCollection<IStudentSegmentQuestion>(
      'studentSegmentQuestions',
    );
    this.responsesCollection =
      await this.db.getCollection<IStudentCrowdResponse>(
        'studentCrowdResponses',
      );
    this.initialized = true;

    try {
      await this.collection.createIndex(
        {courseVersionId: 1, segmentId: 1, isDeleted: 1},
        {background: true},
      );
      await this.collection.createIndex(
        {courseVersionId: 1, segmentId: 1, normalizedSignature: 1, isDeleted: 1},
        {background: true},
      );
      // One response per (question, student) — enforces idempotent capture.
      await this.responsesCollection.createIndex(
        {studentQuestionId: 1, userId: 1},
        {unique: true, background: true},
      );
    } catch {
      // index already exists
    }
  }

  async create(
    question: StudentSegmentQuestion,
    session?: ClientSession,
  ): Promise<string> {
    await this.init();
    const result = await this.collection.insertOne(question, {session});
    return result.insertedId.toString();
  }

  async findDuplicate(input: {
    courseVersionId: string;
    segmentId: string;
    normalizedSignature: string;
  }): Promise<IStudentSegmentQuestion | null> {
    await this.init();
    return await this.collection.findOne({
      courseVersionId: new ObjectId(input.courseVersionId),
      segmentId: new ObjectId(input.segmentId),
      normalizedSignature: input.normalizedSignature,
      isDeleted: {$ne: true},
    });
  }

  async listBySegment(input: {
    courseId: string;
    courseVersionId: string;
    segmentId: string;
    limit: number;
  }): Promise<IStudentSegmentQuestion[]> {
    await this.init();
    return await this.collection
      .find({
        courseId: new ObjectId(input.courseId),
        courseVersionId: new ObjectId(input.courseVersionId),
        segmentId: new ObjectId(input.segmentId),
        isDeleted: {$ne: true},
      })
      .sort({createdAt: -1})
      .limit(input.limit)
      .toArray();
  }

  async listByCourseVersion(input: {
    courseId: string;
    courseVersionId: string;
    status?: StudentQuestionStatus;
    limit: number;
  }): Promise<IStudentSegmentQuestion[]> {
    await this.init();
    const filter: Record<string, unknown> = {
      courseId: new ObjectId(input.courseId),
      courseVersionId: new ObjectId(input.courseVersionId),
      isDeleted: {$ne: true},
    };
    if (input.status) {
      filter.status = input.status;
    }
    return await this.collection
      .find(filter)
      .sort({createdAt: -1})
      .limit(input.limit)
      .toArray();
  }

  async listByUserId(input: {
    userId: string;
    status?: StudentQuestionStatus;
    limit: number;
  }): Promise<IStudentSegmentQuestion[]> {
    await this.init();
    const filter: Record<string, unknown> = {
      createdBy: new ObjectId(input.userId),
      isDeleted: {$ne: true},
    };
    if (input.status) {
      filter.status = input.status;
    }
    return await this.collection
      .find(filter)
      .sort({createdAt: -1})
      .limit(input.limit)
      .toArray();
  }

  async findApprovedForSegments(
    segmentIds: string[],
  ): Promise<IStudentSegmentQuestion[]> {
    await this.init();
    if (segmentIds.length === 0) return [];
    return await this.collection
      .find({
        segmentId: {$in: segmentIds.map(id => new ObjectId(id))},
        status: 'APPROVED',
        isDeleted: {$ne: true},
      })
      .toArray();
  }

  async findById(input: {
    courseId: string;
    courseVersionId: string;
    segmentId: string;
    questionId: string;
  }): Promise<IStudentSegmentQuestion | null> {
    await this.init();
    return await this.collection.findOne({
      _id: new ObjectId(input.questionId),
      courseId: new ObjectId(input.courseId),
      courseVersionId: new ObjectId(input.courseVersionId),
      segmentId: new ObjectId(input.segmentId),
      isDeleted: {$ne: true},
    });
  }

  async findDuplicateExcluding(input: {
    courseVersionId: string;
    segmentId: string;
    normalizedSignature: string;
    excludeQuestionId: string;
  }): Promise<IStudentSegmentQuestion | null> {
    await this.init();
    return await this.collection.findOne({
      _id: {$ne: new ObjectId(input.excludeQuestionId)},
      courseVersionId: new ObjectId(input.courseVersionId),
      segmentId: new ObjectId(input.segmentId),
      normalizedSignature: input.normalizedSignature,
      isDeleted: {$ne: true},
    });
  }

  async updateContent(input: {
    courseId: string;
    courseVersionId: string;
    segmentId: string;
    questionId: string;
    questionText: string;
    options: {text: string}[];
    correctOptionIndex: number;
    normalizedSignature: string;
    statusTransition?: {
      status: StudentQuestionStatus;
      reviewedBy: string;
      rejectionReason?: string;
    };
  }): Promise<boolean> {
    await this.init();
    const set: Record<string, unknown> = {
      questionText: input.questionText,
      options: input.options,
      correctOptionIndex: input.correctOptionIndex,
      normalizedSignature: input.normalizedSignature,
      updatedAt: new Date(),
    };
    if (input.statusTransition) {
      set.status = input.statusTransition.status;
      set.reviewedBy = new ObjectId(input.statusTransition.reviewedBy);
      set.reviewedAt = new Date();
      set.rejectionReason =
        input.statusTransition.status === 'REJECTED'
          ? input.statusTransition.rejectionReason
          : undefined;
    }
    const result = await this.collection.updateOne(
      {
        _id: new ObjectId(input.questionId),
        courseId: new ObjectId(input.courseId),
        courseVersionId: new ObjectId(input.courseVersionId),
        segmentId: new ObjectId(input.segmentId),
        isDeleted: {$ne: true},
      },
      {$set: set},
    );
    return result.matchedCount > 0;
  }

  async setPromotedQuestionId(
    studentQuestionId: string,
    promotedId: string,
  ): Promise<void> {
    await this.init();
    await this.collection.updateOne(
      {_id: new ObjectId(studentQuestionId)},
      {$set: {promotedQuestionId: new ObjectId(promotedId), updatedAt: new Date()}},
    );
  }

  async updateStatus(input: {
    courseId: string;
    courseVersionId: string;
    segmentId: string;
    questionId: string;
    status: StudentQuestionStatus;
    reviewedBy: string;
    rejectionReason?: string;
  }): Promise<boolean> {
    await this.init();
    const result = await this.collection.updateOne(
      {
        _id: new ObjectId(input.questionId),
        courseId: new ObjectId(input.courseId),
        courseVersionId: new ObjectId(input.courseVersionId),
        segmentId: new ObjectId(input.segmentId),
        isDeleted: {$ne: true},
      },
      {
        $set: {
          status: input.status,
          reviewedBy: new ObjectId(input.reviewedBy),
          reviewedAt: new Date(),
          rejectionReason:
            input.status === 'REJECTED' ? input.rejectionReason : undefined,
          updatedAt: new Date(),
        },
      },
    );
    return result.matchedCount > 0;
  }

  /**
   * Stage-2 serving pool: COLLECTING (PENDING, not-yet-eligible) crowd questions
   * for the given video segments, excluding a given author and a set of already
   * answered question ids. Sorted by fewest responses first so the pool
   * advances toward the gate threshold evenly. `limit` caps the result.
   */
  async findCollectingForSegments(input: {
    segmentIds: string[];
    excludeUserId: string;
    excludeQuestionIds?: string[];
    limit?: number;
  }): Promise<IStudentSegmentQuestion[]> {
    await this.init();
    if (input.segmentIds.length === 0) return [];
    return this.collection
      .find({
        segmentId: {$in: input.segmentIds.map(id => new ObjectId(id))},
        status: 'PENDING',
        gateState: {$ne: 'ELIGIBLE'},
        isDeleted: {$ne: true},
        createdBy: {$ne: new ObjectId(input.excludeUserId)},
        ...(input.excludeQuestionIds && input.excludeQuestionIds.length > 0
          ? {_id: {$nin: input.excludeQuestionIds.map(id => new ObjectId(id))}}
          : {}),
      })
      .sort({responseCount: 1, createdAt: 1})
      .limit(input.limit ?? 1)
      .toArray();
  }

  /** Question ids (from a candidate set) this user has already responded to. */
  async listAnsweredQuestionIds(
    userId: string,
    questionIds: string[],
  ): Promise<string[]> {
    await this.init();
    if (questionIds.length === 0) return [];
    const docs = await this.responsesCollection
      .find({
        userId: new ObjectId(userId),
        studentQuestionId: {$in: questionIds.map(id => new ObjectId(id))},
      })
      .toArray();
    return docs.map(d => d.studentQuestionId.toString());
  }

  /**
   * Idempotently record one student's ungraded response (answer correctness +
   * optional thumb) to a crowd question, and atomically bump the question's
   * counters on first write only. Returns the updated counters, or null if this
   * (question, student) already responded (no double counting). The caller uses
   * the returned counters to evaluate the promotion gate.
   */
  async recordCrowdResponse(input: {
    studentQuestionId: string;
    userId: string;
    isCorrect: boolean;
    thumb?: 'UP' | 'DOWN';
  }): Promise<{
    responseCount: number;
    correctCount: number;
    thumbsUpCount: number;
    thumbsDownCount: number;
  } | null> {
    await this.init();
    const qId = new ObjectId(input.studentQuestionId);
    try {
      await this.responsesCollection.insertOne({
        studentQuestionId: qId,
        userId: new ObjectId(input.userId),
        isCorrect: input.isCorrect,
        thumb: input.thumb,
        createdAt: new Date(),
      });
    } catch (e: any) {
      // Duplicate key → already responded; do not double-count.
      if (e?.code === 11000) return null;
      throw e;
    }

    const inc: Record<string, number> = {responseCount: 1};
    if (input.isCorrect) inc.correctCount = 1;
    if (input.thumb === 'UP') inc.thumbsUpCount = 1;
    if (input.thumb === 'DOWN') inc.thumbsDownCount = 1;

    const updated = await this.collection.findOneAndUpdate(
      {_id: qId},
      {$inc: inc, $set: {updatedAt: new Date()}},
      {returnDocument: 'after'},
    );
    if (!updated) return null;
    return {
      responseCount: updated.responseCount ?? 0,
      correctCount: updated.correctCount ?? 0,
      thumbsUpCount: updated.thumbsUpCount ?? 0,
      thumbsDownCount: updated.thumbsDownCount ?? 0,
    };
  }

  /** Flip a question to ELIGIBLE (gate passed). Idempotent. */
  async markEligible(studentQuestionId: string): Promise<void> {
    await this.init();
    await this.collection.updateOne(
      {_id: new ObjectId(studentQuestionId), gateState: {$ne: 'ELIGIBLE'}},
      {$set: {gateState: 'ELIGIBLE', eligibleAt: new Date(), updatedAt: new Date()}},
    );
  }

  /** Fetch several questions by id (for serving/capture lookups). */
  async findByIds(ids: string[]): Promise<IStudentSegmentQuestion[]> {
    await this.init();
    if (ids.length === 0) return [];
    return this.collection
      .find({_id: {$in: ids.map(id => new ObjectId(id))}, isDeleted: {$ne: true}})
      .toArray();
  }
}
