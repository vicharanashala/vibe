import { GLOBAL_TYPES } from '#root/types.js';
import { MongoDatabase } from '#shared/database/providers/mongo/MongoDatabase.js';
import { injectable, inject } from 'inversify';
import { Collection, ObjectId } from 'mongodb';
import { CodingSubmission } from '../../../interfaces/CodingSubmission.js';

@injectable()
export class CodingSubmissionRepository {
  private collection: Collection<CodingSubmission>;

  constructor(
    @inject(GLOBAL_TYPES.Database)
    private db: MongoDatabase,
  ) {}

  private async init() {
    if (!this.collection) {
      this.collection = await this.db.getCollection<CodingSubmission>('coding_submissions');
    }
  }

  async getByStudentAndProblem(studentId: string, problemId: string): Promise<CodingSubmission[]> {
    await this.init();
    
    // For dummy MVP problems, their problemId won't be a valid ObjectId (except Two Sum if mapped)
    // To prevent BSONTypeError, we wrap ObjectId creation
    let query: any = { studentId, problemId };
    try {
      if (problemId.length === 24) {
        query.problemId = new ObjectId(problemId);
      }
    } catch (e) {}
    
    return this.collection.find(query).sort({ createdAt: -1 }).toArray();
  }

  async getSolvedProblemIds(studentId: string): Promise<string[]> {
    await this.init();
    const objectIds = await this.collection.distinct('problemId', { studentId, status: 'Accepted' });
    return objectIds.map(id => id.toString());
  }

  async create(submission: CodingSubmission): Promise<CodingSubmission> {
    await this.init();
    const result = await this.collection.insertOne({
      ...submission,
      problemId: new ObjectId(submission.problemId),
      createdAt: new Date()
    });
    return { ...submission, _id: result.insertedId };
  }

  async getAllWithDetails(): Promise<any[]> {
    await this.init();
    const submissions = await this.collection.aggregate([
      {
        $match: { isRun: { $ne: true } }
      },
      {
        $lookup: {
          from: 'coding_problems',
          localField: 'problemId',
          foreignField: '_id',
          as: 'problem'
        }
      },
      {
        $unwind: {
          path: '$problem',
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: 'studentId',
          foreignField: 'firebaseUID',
          as: 'student'
        }
      },
      {
        $unwind: {
          path: '$student',
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $project: {
          _id: 1,
          studentId: 1,
          studentEmail: '$student.email',
          studentFirstName: '$student.firstName',
          studentLastName: '$student.lastName',
          problemId: 1,
          problemTitle: '$problem.title',
          language: 1,
          code: 1,
          status: 1,
          runtimeMs: 1,
          output: 1,
          errorDetail: 1,
          createdAt: 1
        }
      },
      {
        $sort: { createdAt: -1 }
      }
    ]).toArray();

    const hardcodedTitles: Record<string, string> = {
      '64b5f92d4f1a2c3d4e5f6001': 'Two Sum',
      '64b5f92d4f1a2c3d4e5f6002': 'Add Two Numbers',
      '64b5f92d4f1a2c3d4e5f6003': 'Longest Substring Without Repeating Characters',
      '64b5f92d4f1a2c3d4e5f6004': 'Median of Two Sorted Arrays'
    };

    return submissions.map(sub => {
      if (!sub.problemTitle && hardcodedTitles[sub.problemId.toString()]) {
        sub.problemTitle = hardcodedTitles[sub.problemId.toString()];
      }
      return sub;
    });
  }
}
