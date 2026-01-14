import {
  IQuestionDetails,
  IGradingResult,
  IQuestionAnswer,
  IQuestionAnswerFeedback,
  IAttempt,
  IAttemptDetails,
  IQuizSubmissionExport,
  IQuestionInfo,
  IResponseAnswer,
  ISOLAnswer,
} from '#quizzes/interfaces/grading.js';
import {
  QuestionAnswerFeedback,
  Submission,
} from '#quizzes/classes/transformers/Submission.js';
import { IQuestionRenderView } from '#quizzes/question-processing/index.js';
import { QuestionProcessor } from '#quizzes/question-processing/QuestionProcessor.js';

import {
  generateRandomParameterMap,
  getSelectedItemTexts,
} from '#quizzes/utils/index.js';
import { GLOBAL_TYPES } from '#root/types.js';
import {
  BaseService,
  IItemRepository,
  ItemType,
  QuestionType,
  MongoDatabase,
  ILotItem,
} from '#shared/index.js';
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
import {
  BaseQuestion,
  NATQuestion,
  SMLQuestion,
  SOLQuestion,
} from '../classes/transformers/Question.js';
import { UserQuizMetrics } from '../classes/transformers/UserQuizMetrics.js';
import { Attempt } from '../classes/transformers/Attempt.js';
import {
  FeedbackSubmissionItem,
  QuizItem,
} from '#root/modules/courses/classes/transformers/Item.js';
import { QuestionRepository } from '../repositories/index.js';
import { FeedbackRepository } from '../repositories/providers/mongodb/FeedbackRepository.js';
import { COURSES_TYPES } from '#root/modules/courses/types.js';
import { USERS_TYPES } from '#root/modules/users/types.js';
import { ProgressRepository } from '#root/shared/database/providers/mongo/repositories/ProgressRepository.js';
import { ICourseRepository } from '#root/shared/database/interfaces/ICourseRepository.js';
@injectable()
class AttemptService extends BaseService {
  constructor(
    @inject(QUIZZES_TYPES.QuizRepo)
    private quizRepository: QuizRepository,

    @inject(QUIZZES_TYPES.QuestionRepo)
    private questionRepository: QuestionRepository,

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

    @inject(QUIZZES_TYPES.FeedbackRepo)
    private feedbackRepository: FeedbackRepository,

    @inject(COURSES_TYPES.ItemRepo)
    private readonly itemRepo: IItemRepository,

    @inject(USERS_TYPES.ProgressRepo)
    private readonly progressRepository: ProgressRepository,

    @inject(GLOBAL_TYPES.CourseRepo)
    private readonly courseRepo: ICourseRepository,

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
      const questionIdsForBank = await this.questionBankService.getQuestions(
        questionBankRef,
      );
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
    const attempt = await this.attemptRepository.getById(
      attemptId,
      quizId,
      session,
    );
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

  /**
   * Check if the quiz has already been completed by checking if a watchTime entry
   * with endTime exists for this user and quiz.
   */
  private async _isQuizAlreadyCompleted(
    userId: string,
    quizId: string,
    session?: ClientSession,
  ): Promise<boolean> {
    const watchTimes = await this.progressRepository.getWatchTime(
      userId,
      quizId,
      undefined,
      undefined,
      session,
    );

    if (!watchTimes || watchTimes.length === 0) {
      return false;
    }

    return watchTimes.some(wt => wt.endTime !== null && wt.endTime !== undefined);
  }

  /**
   * Update user progress after quiz submission based on the grading result.
   * Only updates if the quiz hasn't been completed before.
   * - If PASSED: currentItem advances to next item
   * - If FAILED: currentItem goes back to previous video
   */
  private async _updateProgressAfterQuizSubmit(
    userId: string,
    quizId: string,
    gradingStatus: 'PASSED' | 'FAILED',
    session?: ClientSession,
  ): Promise<void> {
    const alreadyCompleted = await this._isQuizAlreadyCompleted(userId, quizId, session);

    if (alreadyCompleted) {
      return;
    }
  }

  async attempt(
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

      if (!quiz) {
        throw new NotFoundError(`Quiz with ID ${quizId} not found`);
      }

      const userObjecId = new ObjectId(userId);
      const quizObjecId = new ObjectId(quizId);

      if (!metrics) {
        //1a If not, create a new UserQuizMetrics
        const newMetrics: UserQuizMetrics = new UserQuizMetrics(
          userObjecId,
          quizObjecId,
          quiz.details.maxAttempts,
        );
        //1b Create new UserQuizMetrics
        await this.userQuizMetricsRepository.create(newMetrics, session);

        metrics = await this.userQuizMetricsRepository.get(
          userId,
          quizId,
          session,
        );
      }

      // Ensure metrics exists after creation/fetch
      if (!metrics || !metrics._id) {
        throw new BadRequestError(
          'Unable to get or create quiz metrics for user',
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

      const newAttempt = new Attempt(quizObjecId, userObjecId, questionDetails);

      const attemptId = await this.attemptRepository.create(
        newAttempt,
        session,
      );

      const attemptObjectId = new ObjectId(attemptId);

      //6. Update UserQuizMetrics with the new attempt
      metrics.latestAttemptStatus = 'ATTEMPTED';
      metrics.latestAttemptId = attemptObjectId;

      // if the quiz maxAttempts is -1, the no need to changes remainingAttempts
      metrics.remainingAttempts =
        quiz.details.maxAttempts === -1 ? -1 : metrics.remainingAttempts - 1;
      metrics.attempts.push({ attemptId: attemptObjectId });
      const updatedMetrics = await this.userQuizMetricsRepository.update(
        metrics._id.toString(),
        metrics,
      );

      //6. Return the attempt ID
      return {
        attemptId,
        questionRenderViews,
        userAttempts: updatedMetrics?.attempts.length,
      };
    });
  }

  async submit(
    userId: string | ObjectId,
    quizId: string,
    attemptId: string,
    answers: IQuestionAnswer[],
    isSkipped?: boolean,
  ): Promise<Partial<IGradingResult> | null> {

    /* -------------------- READS OUTSIDE TRANSACTION -------------------- */

    // 1. Fetch quiz
    const quiz = await this.quizRepository.getById(quizId);
    if (!quiz) {
      throw new NotFoundError(`Quiz with ID ${quizId} not found`);
    }

    // 2. Check existing submission (idempotency)
    const existingSubmission = await this.submissionRepository.get(
      quizId,
      userId,
      attemptId,
    );

    if (existingSubmission) {
      throw new BadRequestError(
        `Attempt with ID ${attemptId} has already been submitted`,
      );
    }

    /* -------------------- TRANSACTION (STATE MUTATION ONLY) -------------------- */

    let submissionId: string | undefined;
    let gradingResult: IGradingResult | undefined;

    await this._withTransaction(async session => {
      // Save answers (this method should NOT start its own transaction anymore)
      await this.save(userId, quizId, attemptId, answers, isSkipped);

      // Fetch metrics inside transaction (it is being updated)
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

      if (isSkipped) {
        metrics.latestAttemptStatus = 'SKIPPED';
        metrics.skipCount += 1;

        metrics.attempts.push({
          attemptId: new ObjectId(attemptId),
        });

        await this.userQuizMetricsRepository.update(
          metrics._id.toString(),
          metrics,
          session,
        );

        return;
      }

      // Create submission
      const submission = new Submission(
        new ObjectId(quizId),
        new ObjectId(userId),
        new ObjectId(attemptId),
      );

      submissionId = await this.submissionRepository.create(
        submission,
        session,
      );

      // Update metrics
      metrics.latestSubmissionResultId = new ObjectId(submissionId);
      metrics.latestAttemptStatus = 'SUBMITTED';

      metrics.attempts = metrics.attempts.map(attempt =>
        attempt.attemptId.toString() === attemptId
          ? { ...attempt, submissionResultId: new ObjectId(submissionId) }
          : attempt,
      );

      await this.userQuizMetricsRepository.update(
        metrics._id.toString(),
        metrics,
        session,
      );
    });

    /* -------------------- GRADING (NO TRANSACTION) -------------------- */

    if (isSkipped || !submissionId) {
      return null;
    }

    gradingResult = await this._grade(attemptId, quizId, answers);

    /* -------------------- UPDATE SUBMISSION (SMALL WRITE) -------------------- */

    await this.submissionRepository.update(
      submissionId,
      { gradingResult },
    );

    /* -------------------- RETURN BASED ON QUIZ SETTINGS -------------------- */

    return this._buildGradingResult(quiz, gradingResult);
  }


  async submitFeedBackForm(
    userId: string,
    courseId: string,
    courseVersionId: string,
    feedbackFormId: string,
    details: Record<string, any>,
  ): Promise<string> {
    return this._withTransaction(async session => {
      // 1. Validate Item Group
      const ItemsGroup = await this.itemRepo.findItemsGroupByItemId(
        feedbackFormId,
        session,
      );

      if (!ItemsGroup)
        throw new NotFoundError(
          'No item group found for the provided feedback form.',
        );

      const items = ItemsGroup.items;

      // 2. Find feedback item
      const feedbackIndex = items.findIndex(
        item => item._id.toString() === feedbackFormId,
      );

      if (feedbackIndex === -1)
        throw new NotFoundError(
          'Feedback form item not found inside the item group.',
        );

      // 3. Find previous item
      const previousItem = items[feedbackIndex - 1];

      if (!previousItem)
        throw new NotFoundError(
          'No previous learning item exists before this feedback form.',
        );

      const previousItemId = previousItem._id.toString();
      const previousItemType = previousItem.type;

      // 4. Prevent feedback on feedback items
      if (previousItemType === 'FEEDBACK') {
        throw new BadRequestError(
          'Feedback cannot be submitted for a previous feedback item.',
        );
      }

      // 5. Validate the feedback form
      const feedbackForm = await this.feedbackRepository.getFormById(
        feedbackFormId,
        session,
      );

      if (!feedbackForm) {
        throw new NotFoundError(
          `Feedback form with ID ${feedbackFormId} does not exist.`,
        );
      }

      // 6. Check if the user already submitted feedback for this specific item
      const existingSubmission =
        await this.feedbackRepository.findByUserAndPreviousItem(
          userId.toString(),
          previousItemId.toString(),
          session,
        );

      // if (existingSubmission) {
      //   throw new BadRequestError(
      //     `You have already submitted feedback for the previous item (${previousItemType}).`,
      //   );
      // }

      // 7. Create new feedback submission record
      const newFeedbackSubmission: FeedbackSubmissionItem = {
        userId: new ObjectId(userId),
        courseId: new ObjectId(courseId),
        courseVersionId: new ObjectId(courseVersionId),
        details,
        feedbackFormId: new ObjectId(feedbackFormId),
        previousItemId: new ObjectId(previousItemId),
        previousItemType,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await this.feedbackRepository.createFeedback(
        newFeedbackSubmission,
        session,
      );

      return 'Your feedback has been submitted successfully. Thank you for your response!';
    });
  }

  async save(
    userId: string | ObjectId,
    quizId: string,
    attemptId: string,
    answers: IQuestionAnswer[],
    isSkipped?: boolean,
  ): Promise<{
    result: 'CORRECT' | 'INCORRECT' | 'PARTIALLY_CORRECT';
    explanation?: string;
  }> {
    /* -------------------- READS OUTSIDE TRANSACTION -------------------- */

    // 1. Fetch quiz
    const quiz = await this.quizRepository.getById(quizId);
    if (!quiz) {
      throw new NotFoundError(`Quiz with ID ${quizId} not found`);
    }

    // 2. Deadline validation
    if (
      quiz.details.quizType === 'DEADLINE' &&
      quiz.details.deadline < new Date()
    ) {
      throw new BadRequestError('Quiz deadline has passed');
    }

    // 3. Get last answer (if any)
    const lastAnswer = answers?.at(-1);

    // 4. Fetch question only if needed
    let question:
      | NATQuestion
      | SOLQuestion
      | SMLQuestion
      | undefined;

    if (lastAnswer) {
      question = (await this.questionService.getById(
        lastAnswer.questionId,
        true,
      )) as typeof question;
    }

    /* -------------------- TRANSACTION (WRITE ONLY) -------------------- */
    await this._withTransaction(async session => {
      const attempt = await this.attemptRepository.getById(
        attemptId,
        quizId,
        session,
      );

      if (!attempt) {
        throw new NotFoundError(`Attempt with ID ${attemptId} not found`);
      }

      // Ownership validation
      if (
        attempt.userId.toString() !== userId.toString() ||
        attempt.quizId.toString() !== quizId
      ) {
        throw new BadRequestError(
          'Attempt does not belong to the user or quiz',
        );
      }

      // Update attempt
      attempt.updatedAt = new Date();

      if (isSkipped) {
        attempt.isSkipped = true;
      } else {
        attempt.answers = answers;
      }

      await this.attemptRepository.update(attemptId, attempt);
    });

    /* -------------------- ANSWER EVALUATION (NO TRANSACTION) -------------------- */

    if (isSkipped || !lastAnswer || !question) {
      return {
        result: 'INCORRECT',
        explanation: 'Question was skipped or no answer provided',
      };
    }

    switch (lastAnswer.questionType) {
      case 'NUMERIC_ANSWER_TYPE': {
        const submittedValue = (lastAnswer.answer as { value: number }).value;
        const natQuestion = question as NATQuestion;

        if (
          submittedValue < natQuestion.lowerLimit ||
          submittedValue > natQuestion.upperLimit
        ) {
          throw new BadRequestError(
            `Answer should be in range ${natQuestion.lowerLimit} - ${natQuestion.upperLimit}`,
          );
        }

        return {
          result:
            submittedValue === natQuestion.value ? 'CORRECT' : 'INCORRECT',
        };
      }

      case 'SELECT_ONE_IN_LOT': {
        const answer = lastAnswer.answer as ISOLAnswer;
        const solQuestion = question as SOLQuestion;

        const isCorrect =
          solQuestion.correctLotItem?._id.toString() === answer.lotItemId;

        const allOptions = [
          solQuestion.correctLotItem,
          ...solQuestion.incorrectLotItems,
        ];

        return {
          result: isCorrect ? 'CORRECT' : 'INCORRECT',
          explanation: allOptions.find(
            opt => opt._id.toString() === answer.lotItemId,
          )?.explaination,
        };
      }

      case 'SELECT_MANY_IN_LOT': {
        const answer = lastAnswer.answer as { lotItemIds: string[] };
        const smlQuestion = question as SMLQuestion;

        const isCorrect = smlQuestion.correctLotItems.every(item =>
          answer.lotItemIds.includes(item._id.toString()),
        );

        return {
          result: isCorrect ? 'CORRECT' : 'INCORRECT',
          explanation: isCorrect
            ? smlQuestion.correctLotItems
              .map(item => item.explaination)
              .join(', ')
            : 'Some of the selected answers are incorrect.',
        };
      }

      default:
        return {
          result: 'INCORRECT',
          explanation:
            'Unable to determine correctness for the provided answers.',
        };
    }
  }


  async getAttempt(
    userId: string | ObjectId,
    quizId: string,
    attemptId: string,
  ): Promise<IAttempt> {
    //1. Fetch the attempt by ID
    return this._withTransaction(async session => {
      const attempt = await this.attemptRepository.getById(
        attemptId,
        quizId,
        session,
      );

      if (!attempt) {
        throw new NotFoundError(`Attempt with ID ${attemptId} not found`);
      }
      //2. Check if the attempt belongs to the user and quiz
      if (attempt.userId !== userId || attempt.quizId !== quizId) {
        throw new BadRequestError(
          'Attempt does not belong to the user or quiz',
        );
      }
      return attempt as IAttempt;
    });
  }

  async bulkUpdateUserQuizMetrics(): Promise<{
    updatedCount: number;
    totalCount: number;
  }> {
    const BATCH_SIZE = 5000;
    const bulkOperations: any[] = [];
    let batchCount = 0;
    let updatedCount = 0;

    // Step 1: Get all user_quiz_metrics records
    const metrics = await this.userQuizMetricsRepository.getAll();

    const totalCount = metrics.length; // total records

    for (const metric of metrics) {
      try {
        if (metric.userId && metric.quizId) {
          // Step 2: Find latest attempt for this (userId, quizId)
          // const quiz = await this.quizRepository.getById(metric.quizId.toString());

          // const attemptCount = await this.attemptRepository.countUserAttempts(metric.quizId.toString(), metric.userId.toString());
          // const latestAttempt = await this.attemptRepository.findLatestAttempt(
          //   metric.userId.toString(),
          //   metric.quizId.toString(),
          // );

          // if (/*!latestAttempt ||*/ !quiz && !quiz.details && !attemptCount) continue;

          const normalizedQuizId =
            metric.quizId instanceof ObjectId
              ? metric.quizId
              : new ObjectId(metric.quizId);
          // Step 3: Add to bulk operations
          bulkOperations.push({
            updateOne: {
              filter: { _id: new ObjectId(metric._id) },
              update: {
                $set: {
                  // latestAttemptId: latestAttempt?._id.toString(),
                  // latestAttemptStatus: 'ATTEMPTED',
                  // remainingAttempts: (quiz.details.maxAttempts - attemptCount),
                  quizId: normalizedQuizId,
                },
              },
            },
          });

          // Increment updated count
          updatedCount++;

          // Step 4: Commit in batches
          if (bulkOperations.length === BATCH_SIZE) {
            await this._withTransaction(async session => {
              await this.userQuizMetricsRepository.executeBulkMetricsReset(
                bulkOperations,
                session,
              );
              console.log(
                `✅ Batch ${++batchCount}: Updated ${bulkOperations.length
                } user_quiz_metrics`,
              );
              bulkOperations.length = 0;
            });
          }
        }
      } catch (err) {
        console.error(`Failed to update metric ${metric._id}`, err);
      }
    }

    // Step 5: Final flush
    if (bulkOperations.length > 0) {
      await this._withTransaction(async session => {
        await this.userQuizMetricsRepository.executeBulkMetricsReset(
          bulkOperations,
          session,
        );
        console.log(
          `✅ Final batch: Updated ${bulkOperations.length} user_quiz_metrics`,
        );
      });
    }

    console.log(`🔹 Done! Updated ${updatedCount} / ${totalCount} records`);
    return { updatedCount, totalCount };
  }

  async exportQuizSubmissions(
    quizId: string,
  ): Promise<IQuizSubmissionExport[]> {
    return this._withTransaction(async session => {
      const attempts = await this.attemptRepository.getAttemptsByQuizId(
        quizId,
        session,
      );
      // Transform attempts data as needed for export

      let exportData: IQuizSubmissionExport[] = [];

      const lotItemTextProcessors: Record<
        QuestionType,
        (
          questionInfo: IQuestionInfo,
          responseAnswer: IResponseAnswer,
        ) => string | string[]
      > = {
        SELECT_ONE_IN_LOT: (
          questionInfo: IQuestionInfo,
          responseAnswer: IResponseAnswer,
        ) => {
          // For SELECT_ONE_IN_LOT, responseAnswer.answer is a single lotItemId
          let selectedLotItemId: string =
            responseAnswer.answer.lotItemId.toString();

          // Find the lot item text from questionInfo

          const lotItem =
            questionInfo.correctLotItems?.find(
              item => item._id?.toString() === selectedLotItemId,
            ) ||
            questionInfo.incorrectLotItems?.find(
              item => item._id?.toString() === selectedLotItemId,
            ) ||
            (questionInfo.correctLotItem?._id.toString() === selectedLotItemId
              ? questionInfo.correctLotItem
              : undefined);

          if (lotItem) {
            return lotItem.text;
          }
        },
        SELECT_MANY_IN_LOT: (
          questionInfo: IQuestionInfo,
          responseAnswer: IResponseAnswer,
        ) => {
          // For SELECT_MANY_IN_LOT, responseAnswer.answer is an array of lotItemIds
          let selectedLotItemIds: string[] =
            responseAnswer.answer.lotItemIds?.map(id => id.toString()) || [];

          // Fetch all selectedLotItem texts from questionInfo
          const selectedLotItems: string[] = [];

          selectedLotItemIds.forEach(lotItemId => {
            const selectedLotItem =
              questionInfo.correctLotItems.find(
                item => item._id?.toString() === lotItemId,
              ) ||
              questionInfo.incorrectLotItems.find(
                item => item._id?.toString() === lotItemId,
              );

            if (selectedLotItem) {
              selectedLotItems.push(selectedLotItem.text);
            }
          });

          return selectedLotItems;
        },
        ORDER_THE_LOTS: (
          questionInfo: IQuestionInfo,
          responseAnswer: IResponseAnswer,
        ) => {
          // Ingore this for now
          return [];
        },
        NUMERIC_ANSWER_TYPE: (
          questionInfo: IQuestionInfo,
          responseAnswer: IResponseAnswer,
        ) => {
          // For NUMERIC_ANSWER_TYPE, responseAnswer.answer is a numeric value
          const numericAnswer = responseAnswer.answer.value;

          return numericAnswer?.toString();
        },
        DESCRIPTIVE: (
          questionInfo: IQuestionInfo,
          responseAnswer: IResponseAnswer,
        ) => {
          // For DESCRIPTIVE, responseAnswer.answer is a text answer
          const textAnswer = responseAnswer.answer.answerText;

          return textAnswer;
        },
      };

      for (const attempt of attempts) {
        if (!attempt.user) continue;
        const userName = attempt.user.firstName + ' ' + attempt.user?.lastName;

        for (let i = 0; i < attempt.questionDetails.length; i++) {
          const questionDetail = attempt.questionDetails[i];
          const responseAnswer = attempt.answers.find(
            ans => ans.questionId.toString() === questionDetail._id.toString(),
          );

          if (!responseAnswer) continue;

          // QuestionDetail will always have questionText.
          // To fetch response text, we need to fetch the lotItem text from the question's lotItems based on question type.
          const questionType = responseAnswer.questionType;
          // Use the function dispatcher to get the appropriate processor
          const processor = lotItemTextProcessors[questionType];
          if (processor) {
            const reponseText = processor(questionDetail, responseAnswer);

            // Prepare export entry
            exportData.push({
              Name: userName,
              Question: questionDetail.text,
              questionType: questionType,
              Response: Array.isArray(reponseText)
                ? reponseText.join(', ')
                : reponseText || '',
            });
          }
        }
      }

      return exportData;
    });
  }
}

export { AttemptService };
