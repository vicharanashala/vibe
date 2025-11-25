import {
  ISubmission,
  ISubmissionWithUser,
  PaginatedSubmissions,
} from '#quizzes/interfaces/grading.js';
import { MongoDatabase } from '#shared/database/providers/mongo/MongoDatabase.js';
import { GLOBAL_TYPES } from '#root/types.js';
import { injectable, inject } from 'inversify';
import { Collection, ClientSession, ObjectId } from 'mongodb';
import { InternalServerError } from 'routing-controllers';
import { GetQuizSubmissionsQuery } from '#root/modules/quizzes/classes/index.js';

@injectable()
class SubmissionRepository {
  private submissionResultCollection: Collection<ISubmission>;

  constructor(
    @inject(GLOBAL_TYPES.Database)
    private db: MongoDatabase,
  ) { }

  private async init() {
    this.submissionResultCollection = await this.db.getCollection<ISubmission>(
      'quiz_submission_results',
    );
  }

  async create(
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

  async get(
    quizId: string,
    userId: string | ObjectId,
    attemptId: string,
    session?: ClientSession,
  ): Promise<ISubmission> {
    await this.init();
    const quizIdStr = quizId.toString();
    const quizIdObj = ObjectId.isValid(quizIdStr)
      ? new ObjectId(quizIdStr)
      : null;

    const userIdStr = userId.toString();
    const userIdObj = ObjectId.isValid(userIdStr)
      ? new ObjectId(userIdStr)
      : null;

    const attemptIdStr = attemptId.toString();
    const attemptIdObj = ObjectId.isValid(attemptIdStr)
      ? new ObjectId(attemptIdStr)
      : null;

    const filter: any = {
      quizId: { $in: [quizIdStr, ...(quizIdObj ? [quizIdObj] : [])] },
      userId: { $in: [userIdStr, ...(userIdObj ? [userIdObj] : [])] },
      attemptId: { $in: [attemptIdStr, ...(attemptIdObj ? [attemptIdObj] : [])] },
    };

    const result = await this.submissionResultCollection.findOne(filter, {
      session,
    });

    // const result = await this.submissionResultCollection.findOne(
    //   {
    //     quizId,
    //     userId,
    //     attemptId,
    //   },
    //   {session},
    // );
    if (!result) {
      return null;
    }
    return {
      ...result,
      quizId: result.quizId?.toString(),
      userId: result.userId?.toString(),
      attemptId: result.attemptId?.toString(),
    };
  }

  async getById(
    submissionId: string,
    quizId: string,
    session?: ClientSession,
  ): Promise<ISubmission> {
    await this.init();
    const quizIdStr = quizId.toString();
    const quizIdObj = ObjectId.isValid(quizIdStr)
      ? new ObjectId(quizIdStr)
      : null;
    const filter: any = {
      _id: new ObjectId(submissionId),
      quizId: { $in: [quizIdStr, ...(quizIdObj ? [quizIdObj] : [])] },
    };

    const result = await this.submissionResultCollection.findOne(filter, {
      session,
    });
    // const result = await this.submissionResultCollection.findOne(
    //   {
    //     _id: new ObjectId(submissionId),
    //     quizId: quizId,
    //   },
    //   {session},
    // );
    if (!result) {
      return null;
    }
    return {
      ...result,
      quizId: result.quizId?.toString(),
      userId: result.userId?.toString(),
      attemptId: result.attemptId?.toString(),
    };
  }

  async update(
    submissionId: string,
    updateData: Partial<ISubmission>,
    session?: ClientSession,
  ): Promise<ISubmission> {
    await this.init();
    const result = await this.submissionResultCollection.findOneAndUpdate(
      { _id: new ObjectId(submissionId) },
      { $set: updateData },
      { returnDocument: 'after', session },
    );
    return result;
  }
  async countByQuizId(
    quizId: string,
    session?: ClientSession,
  ): Promise<number> {
    await this.init();

    const quizIdStr = quizId.toString();
    const quizIdObj = ObjectId.isValid(quizIdStr)
      ? new ObjectId(quizIdStr)
      : null;

    const count = await this.submissionResultCollection.countDocuments(
      {
        quizId: { $in: [quizIdStr, ...(quizIdObj ? [quizIdObj] : [])] },
      },
      { session },
    );
    // const count = await this.submissionResultCollection.countDocuments(
    //   {quizId},
    //   {session},
    // );
    return count;
  }

  async getByQuizId(
    quizId: string,
    session?: ClientSession,
    query: GetQuizSubmissionsQuery = {},
  ): Promise<PaginatedSubmissions> {
    await this.init();

    const { search, gradeStatus, sort = 'DATE_DESC', currentPage, limit } = query;
    const quizIdStr = quizId.toString();
    const quizIdObj = ObjectId.isValid(quizIdStr)
      ? new ObjectId(quizIdStr)
      : null;
    const matchStage: any = {
      quizId: { $in: [quizIdStr, ...(quizIdObj ? [quizIdObj] : [])] },
    };

    if (gradeStatus && gradeStatus !== 'All') {
      matchStage['gradingResult.gradingStatus'] = gradeStatus;
    }

    const sortStage: Record<string, 1 | -1> = (() => {
      switch (sort) {
        case 'date_asc':
          return { submittedAt: 1 };
        case 'date_desc':
          return { submittedAt: -1 };
        case 'score_asc':
          return { 'gradingResult.totalScore': 1 };
        case 'score_desc':
          return { 'gradingResult.totalScore': -1 };
        default:
          return { submittedAt: -1 };
      }
    })();

    const aggregationPipeline: any[] = [
      {
        $match: matchStage,
      },
      {
        $addFields: {
          userId: { $toObjectId: '$userId' },
        },
      },
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'userInfo',
        },
      },
      {
        $unwind: {
          path: '$userInfo',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $addFields: {
          userId: {
            _id: { $toString: '$userInfo._id' },
            firstName: '$userInfo.firstName',
            lastName: '$userInfo.lastName',
            email: '$userInfo.email',
          },
        },
      },
    ];

    if (search && search.trim() !== '') {
      aggregationPipeline.push({
        $match: {
          $or: [
            { 'userInfo.firstName': { $regex: search, $options: 'i' } },
            { 'userInfo.email': { $regex: search, $options: 'i' } },
          ],
        },
      });
    }

    aggregationPipeline.push({ $sort: sortStage });

    let totalCount = 0;
    if (typeof currentPage === 'number' && typeof limit === 'number') {
      const skip = (currentPage - 1) * limit;
      aggregationPipeline.push({ $skip: skip }, { $limit: limit });
      totalCount = await this.submissionResultCollection.countDocuments(
        matchStage,
      );
    }

    const data = await this.submissionResultCollection
      .aggregate(aggregationPipeline, { session })
      .toArray();

    const totalPages =
      typeof limit === 'number' && limit > 0
        ? Math.ceil(totalCount / limit)
        : 1;

    const normalizedData = data.map(doc => {
      return {
        ...doc,
        quizId: doc.quizId?.toString(),
        userId: doc.userId?._id?.toString() || null,
        attemptId: doc.attemptId?.toString(),
      };
    });

    return {
      data: normalizedData as ISubmissionWithUser[],
      totalCount,
      currentPage,
      totalPages,
    };
  }

  async countPassedByQuizId(
    quizId: string,
    session?: ClientSession,
  ): Promise<number> {
    await this.init();
    const quizIdStr = quizId.toString();
    const quizIdObj = ObjectId.isValid(quizIdStr)
      ? new ObjectId(quizIdStr)
      : null;

    const count = await this.submissionResultCollection.countDocuments(
      {
        quizId: { $in: [quizIdStr, ...(quizIdObj ? [quizIdObj] : [])] },
        'gradingResult.gradingStatus': 'PASSED',
      },
      { session },
    );
    // const count = await this.submissionResultCollection.countDocuments(
    //   {quizId, 'gradingResult.gradingStatus': 'PASSED'},
    //   {session},
    // );
    return count;
  }

  async executeBulkSubmissionDelete(
    userId: string,
    attemptIds: string[],
    session?: ClientSession,
  ): Promise<void> {
    await this.init();
    if (!attemptIds.length) return;

    const userIdStr = userId.toString();
    const userIdObj = ObjectId.isValid(userIdStr)
      ? new ObjectId(userIdStr)
      : null;

    const attemptIdsStr = attemptIds.map(id => id.toString());
    const attemptIdsObj = attemptIds
      .filter(id => ObjectId.isValid(id.toString()))
      .map(id => new ObjectId(id.toString()));

    await this.submissionResultCollection.deleteMany(
      {
        userId: { $in: [userIdStr, ...(userIdObj ? [userIdObj] : [])] },
        attemptId: { $in: [...attemptIdsStr, ...attemptIdsObj] },
      },
      { session },
    );

    // await this.submissionResultCollection.deleteMany(
    //   {userId, attemptId: {$in: attemptIds}},
    //   {session},
    // );
  }

  async getAverageScoreByQuizId(
    quizId: string,
    session?: ClientSession,
  ): Promise<number> {
    await this.init();

    const quizIdStr = quizId.toString();
    const quizIdObj = ObjectId.isValid(quizIdStr)
      ? new ObjectId(quizIdStr)
      : null;

    const result = await this.submissionResultCollection
      .aggregate(
        [
          {
            $match: {
              quizId: { $in: [quizIdStr, ...(quizIdObj ? [quizIdObj] : [])] },
            },
          },
          {
            $group: {
              _id: null,
              averageScore: { $avg: '$gradingResult.totalScore' },
            },
          },
        ],
        { session },
      )
      .toArray();
    // const result = await this.submissionResultCollection
    //   .aggregate([
    //     {$match: {quizId}},
    //     {
    //       $group: {
    //         _id: null,
    //         averageScore: {$avg: '$gradingResult.totalScore'},
    //       },
    //     },
    //   ])
    //   .toArray();

    if (result.length > 0 && result[0].averageScore !== null) {
      return result[0].averageScore;
    }
    return 0;
  }

  async bulkConvertIds(batchSize = 500): Promise<{ updated: number }> {
    try {
      await this.init();

      const cursor = this.submissionResultCollection.find(
        {},
        {
          projection: {
            _id: 1,
            quizId: 1,
            userId: 1,
            attemptId: 1,
            'gradingResult.overallFeedback': 1
          },
        },
      );

      let bulkOps: any[] = [];
      let totalUpdated = 0;
      let processedCount = 0;
      let errorCount = 0;

      while (await cursor.hasNext()) {
        processedCount++;
        const submission = await cursor.next();
        if (!submission) continue;

        try {
          let needsUpdate = false;
          const updateFields: Record<string, any> = {};

          // Helper function to safely convert string to ObjectId if valid
          const safeConvertToObjectId = (id: string): string | ObjectId => {
            if (!id || typeof id !== 'string') return id;
            return ObjectId.isValid(id) ? new ObjectId(id) : id;
          };

          // Convert IDs safely
          if (submission.quizId && typeof submission.quizId === 'string') {
            const newId = safeConvertToObjectId(submission.quizId);
            if (newId !== submission.quizId) {
              updateFields.quizId = newId;
              needsUpdate = true;
            }
          }

          if (submission.userId && typeof submission.userId === 'string') {
            const newId = safeConvertToObjectId(submission.userId);
            if (newId !== submission.userId) {
              updateFields.userId = newId;
              needsUpdate = true;
            }
          }

          if (submission.attemptId && typeof submission.attemptId === 'string') {
            const newId = safeConvertToObjectId(submission.attemptId);
            if (newId !== submission.attemptId) {
              updateFields.attemptId = newId;
              needsUpdate = true;
            }
          }

          // Convert questionId in gradingResult.overallFeedback
          if (submission.gradingResult?.overallFeedback?.length > 0) {
            const updatedFeedback = submission.gradingResult.overallFeedback.map((feedback: any) => {
              if (feedback?.questionId && typeof feedback.questionId === 'string') {
                const newQuestionId = safeConvertToObjectId(feedback.questionId);
                if (newQuestionId !== feedback.questionId) {
                  needsUpdate = true;
                  return {
                    ...feedback,
                    questionId: newQuestionId
                  };
                }
              }
              return feedback;
            });

            if (needsUpdate) {
              updateFields['gradingResult.overallFeedback'] = updatedFeedback;
            }
          }

          if (needsUpdate) {
            bulkOps.push({
              updateOne: {
                filter: { _id: submission._id },
                update: { $set: updateFields },
              },
            });
          }

          if (bulkOps.length >= batchSize) {
            const result = await this.submissionResultCollection.bulkWrite(bulkOps);
            totalUpdated += result.modifiedCount || 0;
            bulkOps = [];
          }
        } catch (error) {
          console.error(`Error processing submission ${submission._id}:`, error);
          errorCount++;
          continue;
        }
      }

      // Process any remaining operations
      if (bulkOps.length > 0) {
        const result = await this.submissionResultCollection.bulkWrite(bulkOps);
        totalUpdated += result.modifiedCount || 0;
      }

      console.log(`Processed ${processedCount} submissions, updated ${totalUpdated} documents, ${errorCount} errors`);
      return { updated: totalUpdated };
    } catch (error) {
      console.error('Error in bulkConvertIds:', error);
      throw new InternalServerError(
        `Failed quiz_submission_results ID conversion. More/ ${error}`,
      );
    }
  }

  
  async getAveragePercentageByQuizId(
    quizId: string,
    session?: ClientSession,
  ): Promise<number> {
    await this.init();

    // Fetch quiz to get maxScore
    // const quiz = await this.submissionResultCollection.getById(quizId, session);
    // if (!quiz || !quiz.maxScore) {
    //     return 0; // Return 0 if quiz doesn't exist or maxScore is unavailable
    // }

    const quizIdStr = quizId.toString();
    const quizIdObj = ObjectId.isValid(quizIdStr)
      ? new ObjectId(quizIdStr)
      : null;

    const result = await this.submissionResultCollection
      .aggregate(
        [
          {
            $match: {
              quizId: { $in: [quizIdStr, ...(quizIdObj ? [quizIdObj] : [])] },
            },
          },
          {
            $project: {
              percentage: {
                $multiply: [
                  { $divide: ['$gradingResult.totalScore', "$gradingResult.totalMaxScore"] },
                  100,
                ],
              },
            },
          },
          {
            $group: {
              _id: null,
              averagePercentage: { $avg: '$percentage' },
            },
          },
        ],
        { session },
      )
      .toArray();

    if (result.length > 0 && result[0].averagePercentage !== null) {
      return Math.round(result[0].averagePercentage * 10) / 10;
    }
    console.log("Percentage is ", Math.round(result[0].averagePercentage * 10) / 10)
    return 0;
  }
}

export { SubmissionRepository };
