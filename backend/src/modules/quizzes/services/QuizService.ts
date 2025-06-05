import {inject, injectable} from 'inversify';
import {BaseService} from '../../../shared/classes/BaseService.js';
import GLOBAL_TYPES from '../../../types.js';
import {MongoDatabase} from '../../../shared/database/providers/index.js';
import {IQuestionBankRef} from '../../../shared/interfaces/models.js';
import TYPES from '../types.js';
import {
  AttemptRepository,
  QuizRepository,
  SubmissionRepository,
  UserQuizMetricsRepository,
} from '../repositories/index.js';
import {QuestionBankRepository} from '../repositories/providers/mongodb/QuestionBankRepository.js';
import {InternalServerError, NotFoundError} from 'routing-controllers';
import {
  IGradingResult,
  IQuestionAnswerFeedback,
} from '../interfaces/grading.js';
import {ObjectId} from 'mongodb';

@injectable()
class QuizService extends BaseService {
  constructor(
    @inject(GLOBAL_TYPES.Database)
    public readonly database: MongoDatabase,

    @inject(TYPES.AttemptRepo)
    public readonly attemptRepo: AttemptRepository,

    @inject(TYPES.SubmissionRepo)
    public readonly submissionRepo: SubmissionRepository,

    @inject(TYPES.QuizRepo)
    public readonly quizRepo: QuizRepository,

    @inject(TYPES.QuestionBankRepo)
    public readonly questionBankRepo: QuestionBankRepository,

    @inject(TYPES.UserQuizMetricsRepo)
    public readonly userQuizMetricsRepo: UserQuizMetricsRepository,
  ) {
    super(database);
  }

  addQuestionBank(quizId: string, questionBankRef: IQuestionBankRef) {
    return this._withTransaction(async session => {
      const questionBank = await this.questionBankRepo.getById(
        questionBankRef.bankId,
        session,
      );
      if (!questionBank) {
        throw new NotFoundError('Question bank does not exist.');
      }
      const quiz = await this.quizRepo.getById(quizId, session);
      if (!quiz) {
        throw new NotFoundError('Quiz does not exist.');
      }
      if (
        quiz.details.questionBankRefs.some(
          qb => qb.bankId === questionBankRef.bankId,
        )
      ) {
        throw new Error('Question bank is already added to the quiz.');
      }
      quiz.details.questionBankRefs.push(questionBankRef);
      const result = await this.quizRepo.updateQuiz(quiz, session);
      if (!result) {
        throw new InternalServerError('Failed to add question bank to quiz.');
      }
      return result;
    });
  }
  removeQuestionBank(quizId: string, questionBankId: string) {
    return this._withTransaction(async session => {
      const quiz = await this.quizRepo.getById(quizId, session);
      if (!quiz) {
        throw new NotFoundError('Quiz does not exist.');
      }
      const questionBankIndex = quiz.details.questionBankRefs.findIndex(
        qb => qb.bankId === questionBankId,
      );
      if (questionBankIndex === -1) {
        throw new NotFoundError('Question bank not found in quiz.');
      }
      quiz.details.questionBankRefs.splice(questionBankIndex, 1);
      const result = await this.quizRepo.updateQuiz(quiz, session);
      if (!result) {
        throw new InternalServerError(
          'Failed to remove question bank from quiz.',
        );
      }
      return result;
    });
  }
  editQuestionBankConfiguration(
    quizId: string,
    updatedQuestionBankRef: Partial<IQuestionBankRef>,
  ) {
    return this._withTransaction(async session => {
      const quiz = await this.quizRepo.getById(quizId, session);
      if (!quiz) {
        throw new NotFoundError('Quiz does not exist.');
      }
      const questionBankIndex = quiz.details.questionBankRefs.findIndex(
        qb => qb.bankId === updatedQuestionBankRef.bankId,
      );
      if (questionBankIndex === -1) {
        throw new NotFoundError('Question bank not found in quiz.');
      }
      const existingQuestionBank =
        quiz.details.questionBankRefs[questionBankIndex];
      quiz.details.questionBankRefs[questionBankIndex] = {
        ...existingQuestionBank,
        ...updatedQuestionBankRef,
      };
      const result = await this.quizRepo.updateQuiz(quiz, session);
      if (!result) {
        throw new InternalServerError(
          'Failed to update question bank configuration.',
        );
      }
      return result;
    });
  }
  getAllQuestionBanks(quizId: string) {
    return this._withTransaction(async session => {
      const quiz = await this.quizRepo.getById(quizId, session);
      if (!quiz) {
        throw new NotFoundError('Quiz does not exist.');
      }
      return quiz.details.questionBankRefs;
    });
  }
  getUserMetricsForQuiz(userId: string, quizId: string) {
    return this._withTransaction(async session => {
      const metrics = await this.userQuizMetricsRepo.get(
        userId,
        quizId,
        session,
      );
      if (!metrics) {
        throw new NotFoundError('Metrics not found.');
      }
      return metrics;
    });
  }
  getAttemptDetails(attemptId: string) {
    return this._withTransaction(async session => {
      const attempt = await this.attemptRepo.getById(attemptId);
      if (!attempt) {
        throw new NotFoundError('Attempt does not exist.');
      }
      return attempt;
    });
  }
  getSubmissionDetails(submissionId: string) {
    return this._withTransaction(async session => {
      const submission = await this.submissionRepo.getById(
        submissionId,
        session,
      );
      if (!submission) {
        throw new NotFoundError('Submission does not exist.');
      }
      return submission;
    });
  }
  getQuizDetails(quizId: string) {
    return this._withTransaction(async session => {
      const quiz = await this.quizRepo.getById(quizId, session);
      if (!quiz) {
        throw new NotFoundError('Quiz does not exist.');
      }
      return quiz;
    });
  }
  getQuizAnalytics(quizId: string): Promise<{
    totalAttempts: number;
    submissions: number;
    passRate: number;
    averageScore: number;
  }> {
    return this._withTransaction(async session => {
      const quiz = await this.quizRepo.getById(quizId, session);
      if (!quiz) {
        throw new NotFoundError('Quiz does not exist.');
      }

      const totalAttempts = await this.attemptRepo.countAttempts(
        quizId,
        session,
      );
      const submissions = await this.submissionRepo.countByQuizId(
        quizId,
        session,
      );
      const passedSubmissions = await this.submissionRepo.countPassedByQuizId(
        quizId,
        session,
      );
      const averageScore = await this.submissionRepo.getAverageScoreByQuizId(
        quizId,
        session,
      );

      const passRate =
        totalAttempts > 0 ? (passedSubmissions / totalAttempts) * 100 : 0;

      return {
        totalAttempts,
        submissions,
        passRate,
        averageScore,
      };
    });
  }
  getQuestionPerformanceStats(quizId: string): Promise<
    {
      questionId: string;
      correctRate: number;
      averageScore: number;
    }[]
  > {
    return this._withTransaction(async session => {
      const submissions = await this.submissionRepo.getByQuizId(
        quizId,
        session,
      );
      if (!submissions || submissions.length === 0) {
        throw new NotFoundError('No submissions found for quiz');
      }
      const statsMap = new Map<
        string,
        {correct: number; total: number; score: number}
      >();

      for (const submission of submissions) {
        const feedbacks: IQuestionAnswerFeedback[] =
          submission.gradingResult?.overallFeedback ?? [];

        for (const feedback of feedbacks) {
          const questionId = feedback.questionId.toString(); // normalize ObjectId to string
          const stat = statsMap.get(questionId) || {
            correct: 0,
            total: 0,
            score: 0,
          };

          stat.total += 1;
          if (feedback.status === 'CORRECT') stat.correct += 1;
          // You could also do partial credit for PARTIAL here if you want

          stat.score += feedback.score ?? 0;

          statsMap.set(questionId, stat);
        }
      }

      return Array.from(statsMap.entries()).map(([questionId, stat]) => ({
        questionId,
        correctRate: stat.total === 0 ? 0 : stat.correct / stat.total,
        averageScore: stat.total === 0 ? 0 : stat.score / stat.total,
      }));
    });
  }
  getQuizResults(quizId: string): Promise<
    Array<{
      studentId: string | ObjectId;
      attemptId: string | ObjectId;
      score: number;
      status: 'PENDING' | 'PASSED' | 'FAILED' | any;
    }>
  > {
    return this._withTransaction(async session => {
      const submissions = await this.submissionRepo.getByQuizId(
        quizId,
        session,
      );
      if (!submissions || submissions.length === 0) {
        throw new NotFoundError('No submissions found for quiz');
      }

      return submissions.map(submission => ({
        studentId: submission.userId,
        attemptId: submission.attemptId,
        score: submission.gradingResult.totalScore ?? 0,
        status: submission.gradingResult.gradingStatus,
      }));
    });
  }
  getFlaggedQuestionsForQuiz(quizId: string): Promise<string[]> {
    throw new Error('Method not implemented.');
  }
  overrideSubmissionScore(
    submissionId: string,
    newScore: number,
  ): Promise<void> {
    return this._withTransaction(async session => {
      const submission = await this.submissionRepo.getById(
        submissionId,
        session,
      );
      if (!submission) {
        throw new NotFoundError('Submission does not exist.');
      }
      submission.gradingResult.totalScore = newScore;
      const result = await this.submissionRepo.update(
        submissionId,
        submission,
        session,
      );
      if (!result) {
        throw new InternalServerError('Failed to override submission score.');
      }
    });
  }
  regradeSubmission(
    submissionId: string,
    gradingResult: IGradingResult,
  ): Promise<void> {
    return this._withTransaction(async session => {
      const submission = await this.submissionRepo.getById(
        submissionId,
        session,
      );
      if (!submission) {
        throw new NotFoundError('Submission does not exist.');
      }
      submission.gradingResult = gradingResult;
      const result = await this.submissionRepo.update(
        submissionId,
        submission,
        session,
      );
      if (!result) {
        throw new InternalServerError('Failed to regrade submission.');
      }
    });
  }
  addFeedbackToAnswer(
    submissionId: string,
    questionId: string,
    feedback: string,
  ): Promise<void> {
    return this._withTransaction(async session => {
      const submission = await this.submissionRepo.getById(
        submissionId,
        session,
      );
      if (!submission) {
        throw new NotFoundError('Submission does not exist.');
      }
      const feedbacks: IQuestionAnswerFeedback[] =
        submission.gradingResult?.overallFeedback ?? [];
      const existingFeedback = feedbacks.find(
        f => f.questionId.toString() === questionId,
      );
      if (existingFeedback) {
        existingFeedback.answerFeedback = feedback;
      } else {
        throw new NotFoundError('Feedback for this question does not exist.');
      }
      submission.gradingResult.overallFeedback = feedbacks;
      const result = await this.submissionRepo.update(
        submissionId,
        submission,
        session,
      );
      if (!result) {
        throw new InternalServerError('Failed to add feedback to answer.');
      }
    });
  }
}

export {QuizService};
