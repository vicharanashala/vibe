import {
  IQuestionDetails,
  IGradingResult,
  IQuestionAnswer,
  IQuestionAnswerFeedback,
  IAttempt,
} from '#quizzes/interfaces/grading.js';
import {
  QuestionAnswerFeedback,
  Submission,
} from '#quizzes/classes/transformers/Submission.js';
import { IQuestionRenderView } from '#quizzes/question-processing/index.js';
import { QuestionProcessor } from '#quizzes/question-processing/QuestionProcessor.js';

import { generateRandomParameterMap, getSelectedItemTexts } from '#quizzes/utils/index.js';
import { GLOBAL_TYPES } from '#root/types.js';
import { BaseService, MongoDatabase } from '#shared/index.js';
import { injectable, inject } from 'inversify';
import { ClientSession, ObjectId } from 'mongodb';
import { NotFoundError, BadRequestError } from 'routing-controllers';
import { QuestionBankService } from './QuestionBankService.js';
import { QuestionService } from './QuestionService.js';
import { QUIZZES_TYPES } from '../types.js';
import { instanceToPlain } from 'class-transformer';
import { QuizRepository } from '../repositories/providers/mongodb/QuizRepository.js';
import { AttemptRepository } from '../repositories/providers/mongodb/AttemptRepository.js';
import { SubmissionRepository } from '../repositories/providers/mongodb/SubmissionRepository.js';
import { UserQuizMetricsRepository } from '../repositories/providers/mongodb/UserQuizMetricsRepository.js';
import { BaseQuestion } from '../classes/transformers/Question.js';
import { UserQuizMetrics } from '../classes/transformers/UserQuizMetrics.js';
import { Attempt } from '../classes/transformers/Attempt.js';
import { QuizItem } from '#root/modules/courses/classes/transformers/Item.js';
@injectable()
class AttemptService extends BaseService {
  constructor(
    @inject(QUIZZES_TYPES.QuizRepo)
    private quizRepository: QuizRepository,

    @inject(QUIZZES_TYPES.AttemptRepo)
    private attemptRepository: AttemptRepository,

    @inject(QUIZZES_TYPES.SubmissionRepo)
    private submissionRepository: SubmissionRepository,

    @inject(QUIZZES_TYPES.UserQuizMetricsRepo)
    private userQuizMetricsRepository: UserQuizMetricsRepository,

    @inject(QUIZZES_TYPES.QuestionService)
    private questionService: QuestionService,

    @inject(QUIZZES_TYPES.QuestionBankService)
    private questionBankService: QuestionBankService,

    @inject(GLOBAL_TYPES.Database)
    private readonly database: MongoDatabase,
  ) {
    super(database);
  }

  private async _getQuestionsForAttempt(quiz: QuizItem): Promise<{
    questionDetails: IQuestionDetails[];
    questionRenderViews: IQuestionRenderView[];
  }> {
    const questionsBankRefs = quiz.details.questionBankRefs || [];
    const selectedQuestionIds: string[] = [];

    for (const questionBankRef of questionsBankRefs) {
      const questionIdsForBank =
        await this.questionBankService.getQuestions(questionBankRef);
      selectedQuestionIds.push(...questionIdsForBank);
    }

    const questionDetails: IQuestionDetails[] = [];
    const questionRenderViews: IQuestionRenderView[] = [];

    // Loop through selectedQuestionIds and fetch each question
    for (const questionId of selectedQuestionIds) {
      const question = (await this.questionService.getById(
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
    return { questionDetails, questionRenderViews };
  }

  private _buildGradingResult(
    quiz: QuizItem,
    grading: IGradingResult,
  ): Partial<IGradingResult> {
    const result: Partial<IGradingResult> = {};
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

  private async _grade(
    attemptId: string,
    quizId: string,
    answers: IQuestionAnswer[],
    session?: ClientSession,
  ): Promise<IGradingResult> {
    //1. Fetch the attempt by ID
    const attempt = await this.attemptRepository.getById(attemptId, quizId, session);
    const quiz = await this.quizRepository.getById(
      attempt.quizId.toString(),
      session,
    );
    const feedbacks: IQuestionAnswerFeedback[] = [];
    let totalScore = 0;
    let totalMaxScore = 0;

    for (const answer of answers) {
      const question = await this.questionService.getById(
        answer.questionId,
        true,
      );

      // to get selected answers in text
      const selectedAnswerTexts = getSelectedItemTexts(question, answer.answer);

      totalMaxScore += question.points;
      //Find parameter map for the question
      const questionDetail = attempt.questionDetails.find(
        qd => qd.questionId === answer.questionId,
      );
      const parameterMap = questionDetail?.parameterMap;
      // answer.lotItemId.toString()
      const feedback: IQuestionAnswerFeedback = await new QuestionProcessor(
        question,
      ).grade(answer.answer, quiz, parameterMap, selectedAnswerTexts);
      const res = instanceToPlain(new QuestionAnswerFeedback(feedback));
      feedbacks.push(res as IQuestionAnswerFeedback);
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

  public async attempt(
    userId: string | ObjectId,
    quizId: string,
  ): Promise<{ attemptId: string; questionRenderViews: IQuestionRenderView[] }> {
    return this._withTransaction(async session => {
      //1. Check if UserQuizMetrics exists for the user and quiz
      let metrics = await this.userQuizMetricsRepository.get(
        userId,
        quizId,
        session,
      );


      const quiz = await this.quizRepository.getById(quizId, session);

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
        const createdMetricsId = await this.userQuizMetricsRepository.create(
          newMetrics,
          session,
        );

        metrics = await this.userQuizMetricsRepository.get(
          userId,
          quizId,
          session,
        );
      }


      //2. Check if the quiz is of type 'DEADLINE' and if the deadline has passed
      if (
        quiz.details.quizType === 'DEADLINE' &&
        quiz.details.deadline < new Date()
      ) {
        throw new BadRequestError('Quiz deadline has passed');
      }

      //3. Check if available attempts > 0
      if (metrics.remainingAttempts <= 0 && quiz.details.maxAttempts !== -1) {
        throw new BadRequestError('No available attempts left for this quiz');
      }

      //4. Fetch questions for the quiz attempt
      const { questionDetails, questionRenderViews } =
        await this._getQuestionsForAttempt(quiz);

      //5. Create a new attempt
      const newAttempt = new Attempt(quizId, userId, questionDetails);

      const attemptId = await this.attemptRepository.create(
        newAttempt,
        session,
      );

      //6. Update UserQuizMetrics with the new attempt
      metrics.latestAttemptStatus = 'ATTEMPTED';
      metrics.latestAttemptId = attemptId;
      
      // if the quiz maxAttempts is -1, the no need to changes remainingAttempts
      metrics.remainingAttempts =
        quiz.details.maxAttempts === -1
          ? -1
          : metrics.remainingAttempts - 1;
      metrics.attempts.push({ attemptId });
      const updatedMetrics = await this.userQuizMetricsRepository.update(
        metrics._id.toString(),
        metrics,
      );

      //6. Return the attempt ID
      return { attemptId, questionRenderViews, userAttempts: updatedMetrics?.attempts.length };
    });
  }

  public async submit(
    userId: string | ObjectId,
    quizId: string,
    attemptId: string,
    answers: IQuestionAnswer[],
  ): Promise<Partial<IGradingResult>> {
    return this._withTransaction(async session => {
      await this.save(userId, quizId, attemptId, answers);
      //1. Fetch UserQuizMetrics by userId and quizId
      const metrics = await this.userQuizMetricsRepository.get(
        userId,
        quizId,
        session,
      );
      if (!metrics) {
        throw new NotFoundError(
          `UserQuizMetrics for user ${userId} and quiz ${quizId} not found`,
        );
      }
      //2. Check if Submission Result already exists for the attempt
      const existingSubmission = await this.submissionRepository.get(
        quizId,
        userId,
        attemptId,
        session,
      );
      if (existingSubmission) {
        throw new BadRequestError(
          `Attempt with ID ${attemptId} has already been submitted`,
        );
      }
      //3. Create a new Submission Result
      const submission = new Submission(quizId, userId, attemptId);
      const submissionId = await this.submissionRepository.create(
        submission,
        session,
      );

      //4. Update the submission ID in UserQuizMetrics
      metrics.latestSubmissionResultId = submissionId;

      //5. Change the latestAttemptStatus to 'SUBMITTED'
      metrics.latestAttemptStatus = 'SUBMITTED';

      const gradingResult = await this._grade(attemptId, quizId, answers, session);

      //6. Update the submission with the feedbacks and score
      submission.gradingResult = gradingResult;

      await this.submissionRepository.update(submissionId, submission, session);

      //7. Update the UserQuizMetrics with the new submission result in attempts
      metrics.attempts = metrics.attempts.map(attempt => {
        if (attempt.attemptId === attemptId) {
          attempt.submissionResultId = submissionId;
        }
        return attempt;
      });
      await this.userQuizMetricsRepository.update(
        metrics._id.toString(),
        metrics,
      );

      //8. Get quiz details to check what details can be returned back
      const quiz = await this.quizRepository.getById(quizId, session);

      //9. Return grading result based on quiz settings
      return this._buildGradingResult(quiz, gradingResult);
    });
  }

  public async save(
    userId: string | ObjectId,
    quizId: string,
    attemptId: string,
    answers: IQuestionAnswer[],
  ): Promise<void> {
    return this._withTransaction(async session => {
      //1. Fetch the attempt by ID
      const attempt = await this.attemptRepository.getById(attemptId, quizId, session);
      if (!attempt) {
        throw new NotFoundError(`Attempt with ID ${attemptId} not found`);
      }
      //2. Check if Deadline has passed for the quiz
      const quiz = await this.quizRepository.getById(quizId, session);
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
        throw new BadRequestError(
          'Attempt does not belong to the user or quiz',
        );
      }
      //3. Update the attempt with the answers
      attempt.answers = answers;
      attempt.updatedAt = new Date();

      //4. Save the updated attempt
      await this.attemptRepository.update(attemptId, attempt);
    });
  }

  public async getAttempt(
    userId: string | ObjectId,
    quizId: string,
    attemptId: string,
  ): Promise<IAttempt> {
    //1. Fetch the attempt by ID
    return this._withTransaction(async session => {
      const attempt = await this.attemptRepository.getById(attemptId, quizId, session);
      if (!attempt) {
        throw new NotFoundError(`Attempt with ID ${attemptId} not found`);
      }
      //2. Check if the attempt belongs to the user and quiz
      if (attempt.userId !== userId || attempt.quizId !== quizId) {
        throw new BadRequestError('Attempt does not belong to the user or quiz');
      }
      return attempt as IAttempt;
    })
  }
}

export { AttemptService };
