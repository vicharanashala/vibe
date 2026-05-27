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

@injectable()
export class StudentQuestionRepository {
  private collection!: Collection<IStudentSegmentQuestion>;
  private initialized = false;

  constructor(@inject(GLOBAL_TYPES.Database) private db: MongoDatabase) {}

  private async init() {
    if (this.initialized) return;
    this.collection = await this.db.getCollection<IStudentSegmentQuestion>(
      'studentSegmentQuestions',
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
}
