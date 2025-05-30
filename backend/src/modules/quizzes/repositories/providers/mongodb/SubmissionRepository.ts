import {injectable, inject} from 'inversify';
import {QuizItem} from 'modules/courses';
import {
  IAttempt,
  ISubmission,
  IUserQuizMetrics,
} from 'modules/quizzes/interfaces/grading';
import {Collection} from 'mongodb';
import {InternalServerError} from 'routing-controllers';
import {MongoDatabase} from 'shared/database/providers/MongoDatabaseProvider';
import {Service, Inject} from 'typedi';
import TYPES from '../../../../../types';

@Service()
@injectable()
class SubmissionRepository {
  private submissionResultCollection: Collection<ISubmission>;

  constructor(
    @Inject(() => MongoDatabase)
    @inject(TYPES.Database)
    private db: MongoDatabase,
  ) {}

  private async init() {
    this.submissionResultCollection = await this.db.getCollection<ISubmission>(
      'quiz_submission_results',
    );
  }

  public async create(submission: ISubmission): Promise<string> {
    await this.init();
    const result = await this.submissionResultCollection.insertOne(submission);
    if (result.acknowledged && result.insertedId) {
      return result.insertedId.toString();
    }
    throw new InternalServerError('Failed to create submission result');
  }
  public async get(
    quizId: string,
    userId: string,
    attemptId: string,
  ): Promise<ISubmission> {
    await this.init();
    const result = await this.submissionResultCollection.findOne({
      quizId,
      userId,
      attemptId,
    });
    if (!result) {
      return null;
    }
    return result;
  }
  public async update(
    submissionId: string,
    updateData: Partial<ISubmission>,
  ): Promise<ISubmission> {
    await this.init();
    const result = await this.submissionResultCollection.findOneAndUpdate(
      {_id: submissionId},
      {$set: updateData},
      {returnDocument: 'after'},
    );
    return result;
  }
}

export {SubmissionRepository};
