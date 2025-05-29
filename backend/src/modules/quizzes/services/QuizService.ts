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
import {QuizRepository} from 'shared/database/providers/mongo/repositories/QuizRepository';
import {Attempt} from '../classes/transformers/Attempt';
import {Submission} from '../classes/transformers/Submissions';
import {UserQuizMetrics} from '../classes/transformers/UserQuizMetrics';
import {QuestionService} from './QuestionService';

@Service()
class QuizService {
  constructor(
    @Inject('QuizRepo')
    private quizRepository: QuizRepository,

    @Inject('QuestionService')
    private questionService: QuestionService,
  ) {}

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

    return {questionDetails, questionRenderViews};
  }

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
      const question = await this.questionService.getById(
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
}
