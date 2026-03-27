import {inject, injectable} from 'inversify';
import {Collection, ObjectId} from 'mongodb';
import {MongoDatabase} from '#shared/index.js';
import {GLOBAL_TYPES} from '#root/types.js';
import {
  IStudentSegmentQuestion,
  StudentQuestionStatus,
} from '../../../classes/transformers/StudentSegmentQuestion.js';

@injectable()
export class StudentQuestionRepository {
  private collection: Collection<IStudentSegmentQuestion>;
  private initialized = false;

  constructor(
    @inject(GLOBAL_TYPES.Database)
    private readonly db: MongoDatabase,
  ) {}

  private async init() {
    if (!this.initialized) {
      this.collection = await this.db.getCollection<IStudentSegmentQuestion>(
        'student_segment_questions',
      );
      await this.collection.createIndex({
        courseVersionId: 1,
        segmentId: 1,
        normalizedQuestionText: 1,
      });
      await this.collection.createIndex({courseVersionId: 1, segmentId: 1, createdAt: -1});
      this.initialized = true;
    }
  }

  async create(question: IStudentSegmentQuestion): Promise<string> {
    await this.init();
    const result = await this.collection.insertOne(question);
    return result.insertedId.toString();
  }

  async findDuplicate(input: {
    courseVersionId: string;
    segmentId: string;
    normalizedQuestionText: string;
  }): Promise<IStudentSegmentQuestion | null> {
    await this.init();
    return await this.collection.findOne({
      courseVersionId: new ObjectId(input.courseVersionId),
      segmentId: new ObjectId(input.segmentId),
      normalizedQuestionText: input.normalizedQuestionText,
      $or: [{isDeleted: {$exists: false}}, {isDeleted: false}],
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
      .find(
        {
          courseId: new ObjectId(input.courseId),
          courseVersionId: new ObjectId(input.courseVersionId),
          segmentId: new ObjectId(input.segmentId),
          $or: [{isDeleted: {$exists: false}}, {isDeleted: false}],
        },
        {sort: {createdAt: -1}, limit: input.limit},
      )
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

    const updateDoc: any = {
      $set: {
        status: input.status,
        reviewedBy: new ObjectId(input.reviewedBy),
        reviewedAt: new Date(),
        updatedAt: new Date(),
      },
    };

    if (input.status === 'REJECTED') {
      updateDoc.$set.rejectionReason = input.rejectionReason?.trim() || '';
    } else {
      updateDoc.$unset = {rejectionReason: ''};
    }

    const result = await this.collection.updateOne(
      {
        _id: new ObjectId(input.questionId),
        courseId: new ObjectId(input.courseId),
        courseVersionId: new ObjectId(input.courseVersionId),
        segmentId: new ObjectId(input.segmentId),
        $or: [{isDeleted: {$exists: false}}, {isDeleted: false}],
      },
      updateDoc,
    );

    return result.matchedCount > 0;
  }
}
