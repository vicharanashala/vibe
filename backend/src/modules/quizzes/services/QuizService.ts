import {QuizItem} from 'modules/courses';
import {Collection} from 'mongodb';
import {MongoDatabase} from 'shared/database/providers/MongoDatabaseProvider';
import {Service, Inject} from 'typedi';
import {
  IAttempt,
  IAttemptDetails,
  ISubmissionResult,
  IUserQuizMetrics,
} from '../interfaces/grading';

@Service()
class QuizRepository {
  private quizCollection: Collection<QuizItem>;
  private attemptCollection: Collection<IAttempt>;
  private submissionResultCollection: Collection<ISubmissionResult>;
  private userQuizMetricsCollection: Collection<IUserQuizMetrics>;

  constructor(
    @Inject(() => MongoDatabase)
    private db: MongoDatabase,
  ) {}

  private async init() {
    this.quizCollection = await this.db.getCollection<QuizItem>('quizzes');
    this.attemptCollection =
      await this.db.getCollection<IAttempt>('quiz_attempts');
    this.submissionResultCollection =
      await this.db.getCollection<ISubmissionResult>('quiz_submission_results');
    this.userQuizMetricsCollection =
      await this.db.getCollection<IUserQuizMetrics>('user_quiz_metrics');
  }
}

@Service()
class QuizService {
  public async attempt(): Promise<void> {}
  public async submit(): Promise<void> {}
  public async save(): Promise<void> {}
  private async grade(): Promise<void> {}
}
