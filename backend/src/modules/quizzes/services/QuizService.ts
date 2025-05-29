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
  ISubmission,
  IGradingResult,
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
import {re} from 'mathjs';

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

class Submission implements ISubmission {
  _id?: string;
  quizId: string;
  userId: string;
  attemptId: string;
  submittedAt: Date;
  gradingResult?: IGradingResult;

  constructor(quizId: string, userId: string, attemptId: string) {
    this.quizId = quizId;
    this.userId = userId;
    this.attemptId = attemptId;
    this.submittedAt = new Date();
  }
}

@Service()
class QuizRepository {
  private quizCollection: Collection<QuizItem>;
  private attemptCollection: Collection<IAttempt>;
  private submissionResultCollection: Collection<ISubmission>;
  private userQuizMetricsCollection: Collection<IUserQuizMetrics>;

  constructor(
    @Inject(() => MongoDatabase)
    private db: MongoDatabase,
  ) {}

  private async init() {
    this.quizCollection = await this.db.getCollection<QuizItem>('quizzes');
    this.attemptCollection =
      await this.db.getCollection<IAttempt>('quiz_attempts');
    this.submissionResultCollection = await this.db.getCollection<ISubmission>(
      'quiz_submission_results',
    );
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

  public async createSubmissionResult(
    submission: ISubmission,
  ): Promise<string> {
    await this.init();
    const result = await this.submissionResultCollection.insertOne(submission);
    if (result.acknowledged && result.insertedId) {
      return result.insertedId.toString();
    }
    throw new InternalServerError('Failed to create submission result');
  }
  public async readSubmissionResult(
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
  public async updateSubmissionResult(
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

  private buildGradingResult(
    quiz: QuizItem,
    grading: IGradingResult,
  ): Partial<IGradingResult> {
    let result: Partial<IGradingResult>;

    if (quiz.details.showScoreAfterSubmission) {
      result.totalScore = grading.totalScore;
      result.totalMaxScore = grading.totalMaxScore;
      result.gradingStatus = grading.gradingStatus;
    }

    if (
      quiz.details.showCorrectAnswersAfterSubmission ||
      quiz.details.showExplanationAfterSubmission
    ) {
      result.overallFeedback = grading.overallFeedback;
    }

    return result;
  }

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
  ): Promise<Partial<IGradingResult>> {
    await this.save(userId, quizId, attemptId, answers);
    //1. Fetch UserQuizMetrics by userId and quizId
    const metrics = await this.quizRepository.getUserQuizMetrics(
      userId,
      quizId,
    );
    if (!metrics) {
      throw new NotFoundError(
        `UserQuizMetrics for user ${userId} and quiz ${quizId} not found`,
      );
    }
    //2. Check if Submission Result already exists for the attempt
    const existingSubmission = await this.quizRepository.readSubmissionResult(
      quizId,
      userId,
      attemptId,
    );
    if (existingSubmission) {
      throw new BadRequestError(
        `Attempt with ID ${attemptId} has already been submitted`,
      );
    }
    //3. Create a new Submission Result
    const submission = new Submission(quizId, userId, attemptId);
    const submissionId =
      await this.quizRepository.createSubmissionResult(submission);

    //4. Update the submission ID in UserQuizMetrics
    metrics.latestSubmissionResultId = submissionId;

    //5. Change the latestAttemptStatus to 'SUBMITTED'
    metrics.latestAttemptStatus = 'SUBMITTED';

    const gradingResult = await this.grade(attemptId, answers);

    //6. Update the submission with the feedbacks and score
    submission.gradingResult = gradingResult;

    await this.quizRepository.updateSubmissionResult(submissionId, submission);

    //7. Update the UserQuizMetrics with the new submission result in attempts
    metrics.attempts = metrics.attempts.map(attempt => {
      if (attempt.attemptId === attemptId) {
        attempt.submissionResultId = submissionId;
      }
      return attempt;
    });
    await this.quizRepository.updateUserQuizMetrics(
      metrics._id.toString(),
      metrics,
    );

    //8. Get quiz details to check what details can be returned back
    const quiz = await this.quizRepository.getQuizById(quizId);

    //9. Return grading result based on quiz settings
    return this.buildGradingResult(quiz, gradingResult);
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
    //2. Check if Deadline has passed for the quiz
    const quiz = await this.quizRepository.getQuizById(quizId);
    if (!quiz) {
      throw new NotFoundError(`Quiz with ID ${quizId} not found`);
    }
    if (
      quiz.details.quizType === 'DEADLINE' &&
      quiz.details.deadline < new Date()
    ) {
      throw new BadRequestError('Quiz deadline has passed');
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
  ): Promise<IGradingResult> {
    //1. Fetch the attempt by ID
    const attempt = await this.quizRepository.getAttemptById(attemptId);
    const quiz = await this.quizRepository.getQuizById(
      attempt.quizId.toString(),
    );
    const feedbacks: IQuestionAnswerFeedback[] = [];
    let totalScore;
    let totalMaxScore = 0;

    for (const answer of answers) {
      const question = await this.questionService.getQuestionById(
        answer.questionId,
        true,
      );
      totalMaxScore += question.points;
      //Find parameter map for the question
      const questionDetail = attempt.questionDetails.find(
        qd => qd.questionId === answer.questionId,
      );
      const feedback: IQuestionAnswerFeedback = await new QuestionProcessor(
        question,
      ).grade(answer.answer, quiz, questionDetail.parameterMap);
      feedbacks.push(feedback);
      totalScore += feedback.score;
    }

    const result: IGradingResult = {
      gradingStatus:
        totalScore / totalMaxScore >= quiz.details.passThreshold
          ? 'PASSED'
          : 'FAILED',
      overallFeedback: feedbacks,
      totalMaxScore,
      totalScore,
      gradedAt: new Date(),
      gradedBy: 'system',
    };

    return result;
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
