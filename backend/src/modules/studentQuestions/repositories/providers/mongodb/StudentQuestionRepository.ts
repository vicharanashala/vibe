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
