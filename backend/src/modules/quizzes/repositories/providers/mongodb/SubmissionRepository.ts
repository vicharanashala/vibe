import {injectable, inject} from 'inversify';
import {QuizItem} from '#root/modules/courses/index.js';
import {
  IAttempt,
  ISubmission,
  IUserQuizMetrics,
} from '#root/modules/quizzes/interfaces/grading.js';
import {ClientSession, Collection, ObjectId} from 'mongodb';
import {InternalServerError} from 'routing-controllers';
import {MongoDatabase} from '#root/shared/database/providers/index.js';
import {Service, Inject} from 'typedi';
import GLOBAL_TYPES from '../../../../../types.js';

@Service()
@injectable()
class SubmissionRepository {
  private submissionResultCollection: Collection<ISubmission>;

  constructor(
    @Inject(() => MongoDatabase)
    @inject(GLOBAL_TYPES.Database)
    private db: MongoDatabase,
  ) {}

  private async init() {
    this.submissionResultCollection = await this.db.getCollection<ISubmission>(
      'quiz_submission_results',
    );
  }

  public async create(
    submission: ISubmission,
    session?: ClientSession,
  ): Promise<string> {
    await this.init();
    const result = await this.submissionResultCollection.insertOne(submission, {
      session,
    });
    if (result.acknowledged && result.insertedId) {
      return result.insertedId.toString();
    }
    throw new InternalServerError('Failed to create submission result');
  }
  public async get(
    quizId: string,
    userId: string | ObjectId,
    attemptId: string,
    session?: ClientSession,
  ): Promise<ISubmission> {
    await this.init();
    const result = await this.submissionResultCollection.findOne(
      {
        quizId,
        userId,
        attemptId,
      },
      {session},
    );
    if (!result) {
      return null;
    }
    return result;
  }
  public async getById(
    submissionId: string,
    session?: ClientSession,
  ): Promise<ISubmission> {
    await this.init();
    const result = await this.submissionResultCollection.findOne(
      {
        _id: submissionId,
      },
      {session},
    );
    if (!result) {
      return null;
    }
    return result;
  }
  public async update(
    submissionId: string,
    updateData: Partial<ISubmission>,
    session?: ClientSession,
  ): Promise<ISubmission> {
    await this.init();
    const result = await this.submissionResultCollection.findOneAndUpdate(
      {_id: submissionId},
      {$set: updateData},
      {returnDocument: 'after'},
    );
    return result;
  }
  public async countByQuizId(
    quizId: string,
    session?: ClientSession,
  ): Promise<number> {
    await this.init();
    const count = await this.submissionResultCollection.countDocuments(
      {quizId},
      {session},
    );
    return count;
  }
  public async getByQuizId(
    quizId: string,
    session?: ClientSession,
  ): Promise<ISubmission[]> {
    await this.init();
    const results = await this.submissionResultCollection
      .find({quizId}, {session})
      .toArray();
    return results;
  }
  public async countPassedByQuizId(
    quizId: string,
    session?: ClientSession,
  ): Promise<number> {
    await this.init();
    const count = await this.submissionResultCollection.countDocuments(
      {quizId, 'gradingResult.gradingStatus': 'PASSED'},
      {session},
    );
    return count;
  }
  public async getAverageScoreByQuizId(
    quizId: string,
    session?: ClientSession,
  ): Promise<number> {
    await this.init();
    const result = await this.submissionResultCollection
      .aggregate([
        {$match: {quizId}},
        {
          $group: {
            _id: null,
            averageScore: {$avg: '$gradingResult.totalScore'},
          },
        },
      ])
      .toArray();

    if (result.length > 0 && result[0].averageScore !== null) {
      return result[0].averageScore;
    }
    return 0;
  }
}

export {SubmissionRepository};
