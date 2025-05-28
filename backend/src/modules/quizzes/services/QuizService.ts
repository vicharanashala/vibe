import {QuizItem} from 'modules/courses';
import {ClientSession, Collection} from 'mongodb';
import {MongoDatabase} from 'shared/database/providers/MongoDatabaseProvider';
import {Service, Inject} from 'typedi';
import {
  IAttempt,
  IAttemptDetails,
  IQuestionAnswer,
  IQuestionAnswerFeedback,
  IQuestionDetails,
  ISubmissionResult,
  IUserQuizMetrics,
} from '../interfaces/grading';
import {
  BadRequestError,
  InternalServerError,
  NotFoundError,
} from 'routing-controllers';
import {QuestionType} from 'shared/interfaces/quiz';
import {BaseQuestion} from '../classes/transformers';
import {QuestionProcessor} from '../question-processing/QuestionProcessor';
import {IQuestionRenderView} from '../question-processing/renderers';
import {ParameterMap} from '../question-processing/tag-parser';
import {generateRandomParameterMap} from '../utils/functions/generateRandomParameterMap';

class Attempt implements IAttempt {
  _id?: string;
  quizId: string;
  userId: string;
  questionDetails: IQuestionDetails[]; // List of question IDs in the quiz
  answers?: IQuestionAnswer[];
  createdAt: Date;
  updatedAt: Date;

  constructor(
    quizId: string,
    userId: string,
    questionDetails: IQuestionDetails[],
  ) {
    this.quizId = quizId;
    this.userId = userId;
    this.questionDetails = questionDetails;
    this.createdAt = new Date();
    this.updatedAt = new Date();
  }
}

class UserQuizMetrics implements IUserQuizMetrics {
  userId: string;
  quizId: string;
  remainingAttempts: number;
  latestAttemptId?: string;
  latestAttemptStatus: 'ATTEMPTED' | 'SUBMITTED';
  attempts: IAttemptDetails[];

  constructor(userId: string, quizId: string, maxAttempts: number) {
    this.userId = userId;
    this.quizId = quizId;
    this.remainingAttempts = maxAttempts;
    this.latestAttemptStatus = 'ATTEMPTED';
    this.attempts = [];
  }
}

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

  public async createAttempt(attempt: IAttempt, session?: ClientSession) {
    await this.init();
    const result = await this.attemptCollection.insertOne(attempt, {session});
    if (result.acknowledged && result.insertedId) {
      return result.insertedId.toString();
    }
    throw new InternalServerError('Failed to create quiz attempt');
  }
  public async getAttemptById(attemptId: string): Promise<IAttempt | null> {
    await this.init();
    const result = await this.attemptCollection.findOne({_id: attemptId});
    if (!result) {
      return null;
    }
    return result;
  }
  public async updateAttempt(attemptId: string, updateData: Partial<IAttempt>) {
    await this.init();
    const result = await this.attemptCollection.findOneAndUpdate(
      {_id: attemptId},
      {$set: updateData},
      {returnDocument: 'after'},
    );
    return result;
  }

  //   public async createSubmissionResult(submission: ISubmissionResult): Promise<ISubmissionResult> {}
  //   public async readSubmissionResultById(submissionId: string): Promise<ISubmissionResult> {}
  //   public async updateSubmissionResult(
  //         submissionId: string,
  //         updateData: Partial<ISubmissionResult>,
  //     ): Promise<ISubmissionResult> {}

  //CRUD for Quiz COllection
  public async getQuizById(
    quizId: string,
    session?: ClientSession,
  ): Promise<QuizItem | null> {
    await this.init();
    const result = await this.quizCollection.findOne({_id: quizId}, {session});
    if (!result) {
      return null;
    }
    return result;
  }

  public async createUserQuizMetrics(
    metrics: IUserQuizMetrics,
    session?: ClientSession,
  ): Promise<string | null> {
    await this.init();
    const result = await this.userQuizMetricsCollection.insertOne(metrics, {
      session,
    });
    if (result.acknowledged && result.insertedId) {
      return result.insertedId.toString();
    }
    throw new InternalServerError('Failed to create user quiz metrics');
  }
  public async getUserQuizMetrics(
    userId: string,
    quizId: string,
    session?: ClientSession,
  ): Promise<IUserQuizMetrics | null> {
    await this.init();
    const result = await this.userQuizMetricsCollection.findOne(
      {userId, quizId},
      {session},
    );
    if (!result) {
      return null;
    }
    return result;
  }
  // public async readUserQuizMetricsById(metricsId: string): Promise<IUserQuizMetrics> {}
  public async updateUserQuizMetrics(
    metricsId: string,
    updateData: Partial<IUserQuizMetrics>,
  ): Promise<IUserQuizMetrics> {
    await this.init();
    const result = await this.userQuizMetricsCollection.findOneAndUpdate(
      {_id: metricsId},
      {$set: updateData},
      {returnDocument: 'after'},
    );

    return result;
  }
}

class QuestionRepository {
  private questionCollection: Collection<BaseQuestion>;

  constructor(
    @Inject(() => MongoDatabase)
    private db: MongoDatabase,
  ) {}

  private async init() {
    this.questionCollection =
      await this.db.getCollection<BaseQuestion>('questions');
  }

  public async createQuestion(question: BaseQuestion) {
    await this.init();
    const result = await this.questionCollection.insertOne(question);
    if (result.acknowledged && result.insertedId) {
      return result.insertedId.toString();
    }
    throw new InternalServerError('Failed to create question');
  }

  public async getQuestionById(
    questionId: string,
  ): Promise<BaseQuestion | null> {
    await this.init();
    const result = await this.questionCollection.findOne({_id: questionId});
    if (!result) {
      return null;
    }
    return result;
  }
}

@Service()
class QuizService {
  constructor(
    @Inject(() => QuizRepository)
    private quizRepository: QuizRepository,

    @Inject(() => QuestionService)
    private questionService: QuestionService,
  ) {}

  public async attempt(
    userId: string,
    quizId: string,
  ): Promise<{attemptId: string; questionRenderViews: IQuestionRenderView[]}> {
    //1. Check if UserQuizMetrics exists for the user and quiz
    let metrics = await this.quizRepository.getUserQuizMetrics(userId, quizId);
    const quiz = await this.quizRepository.getQuizById(quizId);
    if (!metrics) {
      //1a If not, create a new UserQuizMetrics
      if (!quiz) {
        throw new NotFoundError(`Quiz with ID ${quizId} not found`);
      }

      const newMetrics: UserQuizMetrics = new UserQuizMetrics(
        userId,
        quizId,
        quiz.details.maxAttempts,
      );
      //1b Create new UserQuizMetrics
      const createdMetricsId =
        await this.quizRepository.createUserQuizMetrics(newMetrics);

      metrics = await this.quizRepository.getUserQuizMetrics(userId, quizId);
    }

    //2. Check if the quiz is of type 'DEADLINE' and if the deadline has passed
    if (
      quiz.details.quizType === 'DEADLINE' &&
      quiz.details.deadline < new Date()
    ) {
      throw new BadRequestError('Quiz deadline has passed');
    }

    //3. Check if available attempts > 0
    if (metrics.remainingAttempts <= 0 || metrics.remainingAttempts !== -1) {
      throw new BadRequestError('No available attempts left for this quiz');
    }

    //4. Fetch questions for the quiz attempt
    const {questionDetails, questionRenderViews} =
      await this.getQuestionsForAttempt(quiz);

    //5. Create a new attempt
    const newAttempt = new Attempt(quizId, userId, questionDetails);

    const attemptId = await this.quizRepository.createAttempt(newAttempt);

    //6. Update UserQuizMetrics with the new attempt
    metrics.latestAttemptStatus = 'ATTEMPTED';
    metrics.latestAttemptId = attemptId;
    metrics.remainingAttempts--;
    metrics.attempts.push({attemptId});
    await this.quizRepository.updateUserQuizMetrics(
      metrics._id.toString(),
      metrics,
    );

    //6. Return the attempt ID
    return {attemptId, questionRenderViews};
  }
  public async submit(
    userId: string,
    quizId: string,
    attemptId: string,
    answers: IQuestionAnswer[],
  ): Promise<void> {
    await this.save(userId, quizId, attemptId, answers);
    const feedbacks = await this.grade(attemptId, answers);
  }
  public async save(
    userId: string,
    quizId: string,
    attemptId: string,
    answers: IQuestionAnswer[],
  ): Promise<void> {
    //1. Fetch the attempt by ID
    const attempt = await this.quizRepository.getAttemptById(attemptId);
    if (!attempt) {
      throw new NotFoundError(`Attempt with ID ${attemptId} not found`);
    }
    //2. Check if the attempt belongs to the user and quiz
    if (attempt.userId !== userId || attempt.quizId !== quizId) {
      throw new BadRequestError('Attempt does not belong to the user or quiz');
    }
    //3. Update the attempt with the answers
    attempt.answers = answers;
    attempt.updatedAt = new Date();

    //4. Save the updated attempt
    await this.quizRepository.updateAttempt(attemptId, attempt);
  }
  private async grade(
    attemptId: string,
    answers: IQuestionAnswer[],
  ): Promise<IQuestionAnswerFeedback[]> {
    //1. Fetch the attempt by ID
    const attempt = await this.quizRepository.getAttemptById(attemptId);
    const quiz = await this.quizRepository.getQuizById(
      attempt.quizId.toString(),
    );
    const feedbacks: IQuestionAnswerFeedback[] = [];
    for (const answer of answers) {
      const question = await this.questionService.getQuestionById(
        answer.questionId,
        true,
      );

      //Find parameter map for the question
      const questionDetail = attempt.questionDetails.find(
        qd => qd.questionId === answer.questionId,
      );
      const feedback: IQuestionAnswerFeedback = await new QuestionProcessor(
        question,
      ).grade(answer.answer, quiz, questionDetail.parameterMap);
      feedbacks.push(feedback);
    }

    return feedbacks;
  }

  private async getQuestionsForAttempt(quiz: QuizItem): Promise<{
    questionDetails: IQuestionDetails[];
    questionRenderViews: IQuestionRenderView[];
  }> {
    const questions = quiz.details.questions;
    const questionVisibility = quiz.details.questionVisibility;
    const numberOfQuestions = questions.length;

    let selectedQuestionIds: string[] = [];

    if (numberOfQuestions > questionVisibility) {
      // Randomly select questionVisibility number of questions
      const shuffledQuestions = questions.sort(() => 0.5 - Math.random());
      selectedQuestionIds = shuffledQuestions.slice(0, questionVisibility);
    } else if (
      numberOfQuestions < questionVisibility ||
      numberOfQuestions === questionVisibility
    ) {
      // If there are fewer questions than visibility, show all questions
      // If there are exactly as many questions as visibility, show all questions
      selectedQuestionIds = questions;
    }

    const questionDetails: IQuestionDetails[] = [];
    const questionRenderViews: IQuestionRenderView[] = [];

    // Loop through selectedQuestionIds and fetch each question
    for (const questionId of selectedQuestionIds) {
      const question = (await this.questionService.getQuestionById(
        questionId,
        true,
      )) as BaseQuestion;
      const questionDetail: IQuestionDetails = {
        questionId: questionId,
        parameterMap: question.isParameterized
          ? generateRandomParameterMap(question.parameters)
          : null,
      };
      questionDetails.push(questionDetail);
      questionRenderViews.push(
        new QuestionProcessor(question).render(questionDetail.parameterMap),
      );
    }

    return {questionDetails, questionRenderViews};
  }
}

@Service()
class QuestionService {
  constructor(
    @Inject(() => QuestionRepository)
    private questionRepository: QuestionRepository,
  ) {}

  public async createQuestion(question: BaseQuestion): Promise<string> {
    return await this.questionRepository.createQuestion(question);
  }

  public async getQuestionById(
    questionId: string,
    raw?: boolean,
    parameterMap?: ParameterMap,
  ): Promise<BaseQuestion | IQuestionRenderView> {
    const question = await this.questionRepository.getQuestionById(questionId);
    if (!question) {
      throw new NotFoundError(`Question with ID ${questionId} not found`);
    }

    if (raw) {
      return question;
    }

    const questionProcessor = new QuestionProcessor(question);
    return questionProcessor.render(parameterMap);
  }
}
