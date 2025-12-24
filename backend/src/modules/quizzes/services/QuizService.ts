import {injectable, inject} from 'inversify';
import {ObjectId} from 'mongodb';
import {NotFoundError, InternalServerError} from 'routing-controllers';
import {QUIZZES_TYPES} from '../types.js';
import {BaseService} from '#root/shared/classes/BaseService.js';
import {MongoDatabase} from '#root/shared/database/providers/mongo/MongoDatabase.js';
import {GLOBAL_TYPES} from '#root/types.js';
import {AttemptRepository} from '../repositories/providers/mongodb/AttemptRepository.js';
import {SubmissionRepository} from '../repositories/providers/mongodb/SubmissionRepository.js';
import {QuizRepository} from '../repositories/providers/mongodb/QuizRepository.js';
import {QuestionBankRepository} from '../repositories/providers/mongodb/QuestionBankRepository.js';
import {UserQuizMetricsRepository} from '../repositories/providers/mongodb/UserQuizMetricsRepository.js';
import {IQuestionBankRef, ItemType} from '#root/shared/interfaces/models.js';
import {
  IGradingResult,
  IQuestionAnswerFeedback,
  ISubmission,
  ISubmissionWithUser,
  PaginatedSubmissions,
} from '../interfaces/grading.js';
import {GetQuizSubmissionsQuery, QuestionBankRef} from '../classes/index.js';
import {QuestionBankService} from './QuestionBankService.js';
import {
  EnrollmentRepository,
  ICourseRepository,
  IItemRepository,
} from '#root/shared/index.js';
import {USERS_TYPES} from '#root/modules/users/types.js';
@injectable()
class QuizService extends BaseService {
  constructor(
    @inject(GLOBAL_TYPES.Database)
    public readonly database: MongoDatabase,

    @inject(QUIZZES_TYPES.AttemptRepo)
    public readonly attemptRepo: AttemptRepository,

    @inject(QUIZZES_TYPES.SubmissionRepo)
    public readonly submissionRepo: SubmissionRepository,

    @inject(QUIZZES_TYPES.QuestionBankService)
    public readonly questionBankService: QuestionBankService,

    @inject(QUIZZES_TYPES.QuizRepo)
    public readonly quizRepo: QuizRepository,

    @inject(QUIZZES_TYPES.QuestionBankRepo)
    public readonly questionBankRepo: QuestionBankRepository,

    @inject(QUIZZES_TYPES.UserQuizMetricsRepo)
    public readonly userQuizMetricsRepo: UserQuizMetricsRepository,

    @inject(GLOBAL_TYPES.CourseRepo)
    private readonly courseRepo: ICourseRepository,

    @inject(USERS_TYPES.EnrollmentRepo)
    private readonly enrollmentRepo: EnrollmentRepository,

    @inject(USERS_TYPES.ItemRepo)
    private readonly itemRepo: IItemRepository,
  ) {
    super(database);
  }

  addQuestionBank(quizId: string, questionBankRef: IQuestionBankRef) {
    return this._withTransaction(async session => {
      const questionBank = await this.questionBankRepo.getById(
        questionBankRef.bankId.toString(),
        session,
      );
      if (!questionBank) {
        throw new NotFoundError('Question bank does not exist.');
      }
      const quiz = await this.quizRepo.getById(quizId, session);
      if (!quiz) {
        throw new NotFoundError('Quiz does not exist.');
      }
      if (!quiz.details.questionBankRefs) {
        quiz.details.questionBankRefs = [];
      }
      if (
        quiz.details.questionBankRefs.some(
          qb => qb.bankId.toString() === questionBankRef.bankId.toString(),
        )
      ) {
        throw new Error('Question bank is already added to the quiz.');
      }
      questionBankRef.bankId = new ObjectId(questionBankRef.bankId);
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
        qb => qb.bankId.toString() === questionBankId.toString(),
      );
      if (questionBankIndex === -1) {
        throw new NotFoundError('Question bank not found in quiz.');
      }
      quiz.details.questionBankRefs.splice(questionBankIndex, 1);

      quiz.details.questionBankRefs.map((ref: QuestionBankRef) => {
        return {
          ...ref,
          bankId: new ObjectId(ref.bankId),
        };
      });

      const result = await this.quizRepo.updateQuiz(quiz, session);
      if (!result) {
        throw new InternalServerError(
          'Failed to remove question bank from quiz.',
        );
      }

      await this.questionBankService.delete(questionBankId, session);

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
        qb => qb.bankId.toString() === updatedQuestionBankRef.bankId.toString(),
      );
      updatedQuestionBankRef.bankId = new ObjectId(
        updatedQuestionBankRef.bankId,
      );
      if (questionBankIndex === -1) {
        throw new NotFoundError('Question bank not found in quiz.');
      }
      const existingQuestionBank =
        quiz.details.questionBankRefs[questionBankIndex];
      // to confirm bankid always objectId
      existingQuestionBank.bankId = new ObjectId(existingQuestionBank.bankId);
      quiz.details.questionBankRefs[questionBankIndex] = {
        ...existingQuestionBank,
        ...{
          count: updatedQuestionBankRef.count,
          difficulty: updatedQuestionBankRef.difficulty,
          tags: updatedQuestionBankRef.tags,
        },
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
      const refs = quiz.details.questionBankRefs || [];
      const banks = await Promise.all(
        refs.map(async ref => {
          const bank = await this.questionBankRepo.getById(
            ref.bankId.toString(),
            session,
          );
          if (!bank) {
            return null;
          }
          return {
            ...ref,
            bankId: ref.bankId.toString(),
            title: bank.title,
            description: bank.description,
            tags: bank.tags,
          };
        }),
      );
      return banks.filter(Boolean);
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
      metrics._id = metrics._id.toString();
      metrics.quizId = metrics.quizId.toString();
      if (Array.isArray(metrics.attempts)) {
        metrics.attempts = metrics.attempts.map(attempt => ({
          ...attempt,
          attemptId: attempt.attemptId.toString(),
        }));
      }
      return metrics;
    });
  }
  getAttemptDetails(attemptId: string, quizId: string) {
    return this._withTransaction(async session => {
      const attempt = await this.attemptRepo.getById(
        attemptId,
        quizId,
        session,
      );
      if (!attempt) {
        throw new NotFoundError('Attempt does not exist.');
      }
      attempt._id = attempt._id.toString();
      return attempt;
    });
  }
  getSubmissionDetails(submissionId: string, quizId: string) {
    return this._withTransaction(async session => {
      const submission = await this.submissionRepo.getById(
        submissionId,
        quizId,
        session,
      );
      if (!submission) {
        throw new NotFoundError('Submission does not exist.');
      }
      submission._id = submission._id.toString(); // Convert ObjectId to string
      return submission;
    });
  }
  getQuizDetails(quizId: string) {
    return this._withTransaction(async session => {
      const quiz = await this.quizRepo.getById(quizId, session);
      if (!quiz) {
        throw new NotFoundError('Quiz does not exist.');
      }
      quiz._id = quiz._id.toString();
      return quiz;
    });
  }
  async getQuizAnalytics(quizId: string): Promise<{
    totalAttempts: number;
    submissions: number;
    passRate: number;
    averageScore: number;
    averagePercentage: number;
  }> {
    return this._withTransaction(async session => {
      const quiz = await this.quizRepo.getById(quizId, session);
      if (!quiz) {
        throw new NotFoundError('Quiz does not exist.');
      }

      // Run all analytics queries in parallel
      const [
        totalAttempts,
        submissions,
        passedSubmissions,
        averageScore,
        averagePercentage,
      ] = await Promise.all([
        this.attemptRepo.countAttempts(quizId, session),
        this.submissionRepo.countByQuizId(quizId, session),
        this.submissionRepo.countPassedByQuizId(quizId, session),
        this.submissionRepo.getAverageScoreByQuizId(quizId, session),
        this.submissionRepo.getAveragePercentageByQuizId(quizId, session),
      ]);

      return {
        totalAttempts,
        submissions,
        passRate:
          totalAttempts > 0 ? (passedSubmissions / totalAttempts) * 100 : 0,
        averageScore,
        averagePercentage,
      };
    });
  }

  async getQuestionPerformanceStats(quizId: string): Promise<
    {
      questionId: string;
      correctRate: number;
      averageScore: number;
      message?: string;
    }[]
  > {
    return this._withTransaction(async session => {
      const submissions = await this.submissionRepo.getByQuizId(
        quizId,
        session,
      );
      if (!submissions.data?.length) {
        return [
          {
            questionId: '',
            correctRate: 0,
            averageScore: 0,
            message: 'No submissions found for quiz',
          },
        ];
      }

      const stats: Record<
        string,
        {correct: number; total: number; score: number}
      > = Object.create(null);

      for (const submission of submissions.data) {
        for (const feedback of submission.gradingResult?.overallFeedback ??
          []) {
          const qid = feedback.questionId.toString();
          if (!stats[qid]) stats[qid] = {correct: 0, total: 0, score: 0};

          stats[qid].total += 1;
          if (feedback.status === 'CORRECT') stats[qid].correct += 1;
          stats[qid].score += feedback.score ?? 0;
        }
      }

      return Object.entries(stats).map(
        ([questionId, {correct, total, score}]) => ({
          questionId,
          correctRate: total ? correct / total : 0,
          averageScore: total ? score / total : 0,
        }),
      );
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
      if (!submissions.data || submissions.data.length === 0) {
        throw new NotFoundError('No submissions found for quiz');
      }
      return submissions.data.map(submission => ({
        studentId: submission.userId?._id,
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
    quizId: string,
    newScore: number,
  ): Promise<void> {
    return this._withTransaction(async session => {
      const submission = await this.submissionRepo.getById(
        submissionId,
        quizId,
        session,
      );
      if (!submission) {
        throw new NotFoundError('Submission does not exist.');
      }
      submission.gradingResult.totalScore = newScore;
      submission.attemptId = new ObjectId(submission.attemptId);
      submission.quizId = new ObjectId(submission.quizId);
      submission.userId = new ObjectId(submission.userId);

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
    quizId: string,
    gradingResult: Partial<IGradingResult>,
  ): Promise<void> {
    return this._withTransaction(async session => {
      const submission = await this.submissionRepo.getById(
        submissionId,
        quizId,
        session,
      );
      if (!submission) {
        throw new NotFoundError('Submission does not exist.');
      }
      const filteredGradingResult = Object.fromEntries(
        Object.entries(gradingResult).filter(([_, v]) => v !== undefined),
      );
      submission.gradingResult = {
        ...submission.gradingResult,
        ...filteredGradingResult,
      };

      submission.attemptId = new ObjectId(submission.attemptId);
      submission.quizId = new ObjectId(submission.quizId);
      submission.userId = new ObjectId(submission.userId);

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
    quizId: string,
    questionId: string,
    feedback: string,
  ): Promise<void> {
    return this._withTransaction(async session => {
      const submission = await this.submissionRepo.getById(
        submissionId,
        quizId,
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
      submission.attemptId = new ObjectId(submission.attemptId);
      submission.quizId = new ObjectId(submission.quizId);
      submission.userId = new ObjectId(submission.userId);

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
  getCourseInfo(quizId: string): Promise<Record<string, Set<string>>> {
    return this._withTransaction(async session => {
      const quiz = await this.quizRepo.getById(quizId, session);
      if (!quiz) {
        throw new NotFoundError('Quiz does not exist.');
      }
      const quesBankIds = quiz.details.questionBankRefs.map(qb => qb.bankId);
      if (quesBankIds.length === 0) {
        throw new Error('No question banks associated with this quiz.');
      }

      // Map to group courseVersionIds by courseId
      const courseMap: Record<string, Set<string>> = {};

      for (const questionBankId of quesBankIds) {
        const questionBank = await this.questionBankRepo.getById(
          questionBankId.toString(),
          session,
        );
        if (!questionBank) {
          throw new NotFoundError('Question bank not found');
        }
        const courseId = questionBank.courseId.toString();
        const courseVersionId = questionBank.courseVersionId;
        if (!courseId && !courseVersionId) {
          throw new Error(
            'Question bank does not have a course or course version associated',
          );
        }
        if (courseId) {
          if (!courseMap[courseId]) {
            courseMap[courseId] = new Set();
          }
          if (courseVersionId) {
            courseMap[courseId].add(courseVersionId.toString());
          }
        }
      }
      return courseMap;
    });
  }
  getAllSubmissions(
    quizId: string,
    query: GetQuizSubmissionsQuery,
  ): Promise<PaginatedSubmissions> {
    return this._withTransaction(async session => {
      const submissions = await this.submissionRepo.getByQuizId(
        quizId,
        session,
        query,
      );
      if (!submissions.data || submissions.data.length === 0) {
        // throw new NotFoundError('No submissions found for quiz');
        return {
          data: [],
          totalCount: 0,
          currentPage: query.currentPage || 1,
          totalPages: 0,
          message: 'No submissions found for quiz',
        };
      }
      // Convert _id to string for each submission
      // return submissions.data.map(sub => ({
      //   ...sub,
      //   _id: sub._id.toString(),
      // }));
      return submissions;
    });
  }

  resetAvailableAttempts(quizId: string, userId: string): Promise<void> {
    return this._withTransaction(async session => {
      const quiz = await this.quizRepo.getById(quizId, session);
      if (!quiz) {
        throw new NotFoundError('Quiz does not exist.');
      }
      const metrics = await this.userQuizMetricsRepo.get(
        userId,
        quizId,
        session,
      );
      if (!metrics) {
        throw new NotFoundError('User metrics not found.');
      }
      metrics.remainingAttempts = quiz.details.maxAttempts;
      await this.userQuizMetricsRepo.update(userId, metrics, session);
    });
  }

  async updateMissingSubmissionResultIds(): Promise<{
    totalCount: number;
    updatedCount: number;
  }> {
    const BATCH_SIZE = 100;
    const bulkOperations = [];
    let batchCount = 0;
    let totalCount = 0;
    let updatedCount = 0;

    try {
      // 2. Find all metrics with attempts that need updates, filtered by course quiz IDs
      const metricsCursor =
        await this.userQuizMetricsRepo.findWithMissingSubmissionIds();

      let metricsProcessed = 0;
      let attemptsProcessed = 0;
      let metricsSkipped = 0;
      let submissionsNotFound = 0;

      // 3. Process each metric
      while (await metricsCursor.hasNext()) {
        const metric = await metricsCursor.next();
        metricsProcessed++;

        if (!metric) {
          metricsSkipped++;
          continue;
        }

        // const quizIdStr = metric.quizId?.toString();
        // if (!quizIdStr || !quizIds.has(quizIdStr)) {
        //   metricsSkipped++;
        //   if (metricsProcessed % 100 === 0) {
        //     console.log(`[updateMissingSubmissionResultIds] Processed ${metricsProcessed} metrics, ${metricsSkipped} skipped (not in course), ${totalCount} updates queued`);
        //   }
        //   continue;
        // }

        // 4. Process each attempt in the metric
        for (const attempt of metric.attempts) {
          attemptsProcessed++;

          // if (attempt.submissionResultId) {
          //   continue; // Skip if already has submissionResultId
          // }

          try {
            // 5. Find corresponding submission

            const submission = await this.submissionRepo.findByAttemptId(
              attempt.attemptId,
            );
            if (!submission) {
              console.log(
                `[updateMissingSubmissionResultIds] No submission found for attempt ${attempt.attemptId}`,
              );
              submissionsNotFound++;
              continue;
            }

            // 6. Add to bulk operations
            bulkOperations.push({
              updateOne: {
                filter: {
                  _id: metric._id,
                  'attempts.attemptId': attempt.attemptId,
                },
                update: {
                  $set: {
                    'attempts.$.submissionResultId': new ObjectId(
                      submission._id,
                    ),
                  },
                },
              },
            });

            totalCount++;

            // 7. Process batch if reached BATCH_SIZE
            if (bulkOperations.length >= BATCH_SIZE) {
              console.log(
                `[updateMissingSubmissionResultIds] Processing batch of ${bulkOperations.length} updates`,
              );
              await this._withTransaction(async session => {
                const result = await this.userQuizMetricsRepo.bulkUpdateMetrics(
                  bulkOperations,
                  session,
                );
                updatedCount += bulkOperations.length;
                console.log(
                  `[updateMissingSubmissionResultIds] ✅ Batch ${++batchCount}: Updated ${
                    bulkOperations.length
                  } attempts. ` +
                    `Total updated: ${updatedCount}/${totalCount} (${Math.round(
                      (updatedCount / totalCount) * 100,
                    )}%)`,
                );
                console.log('results from bulk write in for loop', result);
                bulkOperations.length = 0; // Clear the batch
              });
            }
          } catch (err) {
            console.error(
              `[updateMissingSubmissionResultIds] Failed to process attempt ${attempt.attemptId} in metric ${metric._id}:`,
              err,
            );
          }
        }
      }

      // 7. Process any remaining operations
      if (bulkOperations.length > 0) {
        console.log(
          `[updateMissingSubmissionResultIds] Processing final batch of ${bulkOperations.length} updates`,
        );
        await this._withTransaction(async session => {
          const result = await this.userQuizMetricsRepo.bulkUpdateMetrics(
            bulkOperations,
            session,
          );
          updatedCount += bulkOperations.length;
          console.log(
            `[updateMissingSubmissionResultIds] ✅ Final batch: Updated ${bulkOperations.length} attempts. ` +
              `Total updated: ${updatedCount}/${totalCount} (100%)`,
          );
          console.log(
            'results of bulk write from extra batches, outside loop',
            result,
          );
        });
      }

      console.log(
        `[updateMissingSubmissionResultIds] Process completed. Summary:`,
      );
      console.log(`- Total metrics processed: ${metricsProcessed}`);
      console.log(`- Metrics skipped (invalid): ${metricsSkipped}`);
      console.log(`- Attempts processed: ${attemptsProcessed}`);
      console.log(`- Submissions not found: ${submissionsNotFound}`);
      console.log(`- Total updates queued: ${totalCount}`);
      console.log(`- Total updates applied: ${updatedCount}`);
      console.log(
        `- Batches processed: ${
          batchCount + (bulkOperations.length > 0 ? 1 : 0)
        }`,
      );
      console.log(
        `[updateMissingSubmissionResultIds] Process completed for entire collection`,
      );

      return {totalCount, updatedCount};
    } catch (error) {
      console.error(
        '[updateMissingSubmissionResultIds] Error in updateMissingSubmissionResultIds:',
        error,
      );
      throw error;
    }
  }

  async bulkUpdateVideoName(
    courseId: string,
    courseVersionId: string,
    videoName: string,
  ): Promise<{modifiedCount: number}> {
    return this._withTransaction(async session => {
      const course = await this.courseRepo.read(courseId, session);
      if (!course) {
        throw new NotFoundError(`Course ${courseId} not found`);
      }

      const courseVersion = await this.courseRepo.readVersion(
        courseVersionId,
        session,
      );
      if (!courseVersion) {
        throw new NotFoundError(`Course version ${courseVersionId} not found`);
      }

      const modules = courseVersion.modules ?? [];
      if (!modules.length) {
        return {modifiedCount: 0};
      }

      const videoIds: string[] = [];

      for (const module of modules) {
        for (const section of module.sections ?? []) {
          if (!section.itemsGroupId) continue;

          const itemGroup = await this.itemRepo.readItemsGroup(
            section.itemsGroupId.toString(),
            session,
          );

          if (!itemGroup?.items?.length) continue;

          for (const item of itemGroup.items) {
            if (item.type === ItemType.VIDEO && item._id) {
              videoIds.push(item._id.toString());
            }
          }
        }
      }

      const uniqueVideoIds = [...new Set(videoIds)];
      if (!uniqueVideoIds.length) {
        return {modifiedCount: 0};
      }
      return await this.itemRepo.bulkUpdateVideoName(
        videoIds,
        videoName,
        session,
      );
    });
  }

  
}

export {QuizService};
