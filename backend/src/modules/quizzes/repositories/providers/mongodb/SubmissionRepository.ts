import {
  ISubmission,
  ISubmissionWithUser,
  PaginatedSubmissions,
} from '#quizzes/interfaces/grading.js';
import {MongoDatabase} from '#shared/database/providers/mongo/MongoDatabase.js';
import {GLOBAL_TYPES} from '#root/types.js';
import {injectable, inject} from 'inversify';
import {Collection, ClientSession, ObjectId} from 'mongodb';
import {InternalServerError} from 'routing-controllers';
import {GetQuizSubmissionsQuery} from '#root/modules/quizzes/classes/index.js';

@injectable()
class SubmissionRepository {
  private submissionResultCollection: Collection<ISubmission>;

  constructor(
    @inject(GLOBAL_TYPES.Database)
    private db: MongoDatabase,
  ) {}

  private async init() {
    this.submissionResultCollection = await this.db.getCollection<ISubmission>(
      'quiz_submission_results',
    );
  }

  public async create(
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
  public async get(
    quizId: string,
    userId: string | ObjectId,
    attemptId: string,
    session?: ClientSession,
  ): Promise<ISubmission> {
    await this.init();
    const result = await this.submissionResultCollection.findOne(
      {
        quizId,
        userId,
        attemptId,
      },
      {session},
    );
    if (!result) {
      return null;
    }
    return result;
  }
  public async getById(
    submissionId: string,
    quizId: string,
    session?: ClientSession,
  ): Promise<ISubmission> {
    await this.init();
    const result = await this.submissionResultCollection.findOne(
      {
        _id: new ObjectId(submissionId),
        quizId: quizId,
      },
      {session},
    );
    if (!result) {
      return null;
    }
    return result;
  }
  public async update(
    submissionId: string,
    updateData: Partial<ISubmission>,
    session?: ClientSession,
  ): Promise<ISubmission> {
    await this.init();
    const result = await this.submissionResultCollection.findOneAndUpdate(
      {_id: new ObjectId(submissionId)},
      {$set: updateData},
      {returnDocument: 'after', session},
    );
    return result;
  }
  public async countByQuizId(
    quizId: string,
    session?: ClientSession,
  ): Promise<number> {
    await this.init();
    const count = await this.submissionResultCollection.countDocuments(
      {quizId},
      {session},
    );
    return count;
  }

  public async getByQuizId(
    quizId: string,
    session?: ClientSession,
    query: GetQuizSubmissionsQuery = {},
  ): Promise<PaginatedSubmissions> {
    await this.init();

    const {search, gradeStatus, sort = 'DATE_DESC', currentPage, limit} = query;

    const matchStage = {
      quizId,
    };

    if (gradeStatus && gradeStatus !== 'All') {
      matchStage['gradingResult.gradingStatus'] = gradeStatus;
    }

    const sortStage: Record<string, 1 | -1> = (() => {
      switch (sort) {
        case 'date_asc':
          return {submittedAt: 1};
        case 'date_desc':
          return {submittedAt: -1};
        case 'score_asc':
          return {'gradingResult.totalScore': 1};
        case 'score_desc':
          return {'gradingResult.totalScore': -1};
        default:
          return {submittedAt: -1};
      }
    })();

    const aggregationPipeline: any[] = [
      {
        $match: matchStage,
      },
      {
        $addFields: {
          userId: {$toObjectId: '$userId'},
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
            _id: {$toString: '$userInfo._id'},
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
            {'userInfo.firstName': {$regex: search, $options: 'i'}},
            {'userInfo.email': {$regex: search, $options: 'i'}},
          ],
        },
      });
    }

    aggregationPipeline.push({$sort: sortStage});

    let totalCount = 0;
    if (typeof currentPage === 'number' && typeof limit === 'number') {
      const skip = (currentPage - 1) * limit;
      aggregationPipeline.push({$skip: skip}, {$limit: limit});
      totalCount = await this.submissionResultCollection.countDocuments(
        matchStage,
      );
    }

    const data = await this.submissionResultCollection
      .aggregate(aggregationPipeline, {session})
      .toArray();

    const totalPages =
      typeof limit === 'number' && limit > 0
        ? Math.ceil(totalCount / limit)
        : 1;

    // aggregationPipeline.push(
    //   {$sort: sortStage},
    //   {$skip: skip},
    //   {$limit: limit},
    // );

    // const [data, totalCount] = await Promise.all([
    //   this.submissionResultCollection
    //     .aggregate(aggregationPipeline, {session})
    //     .toArray(),

    //   this.submissionResultCollection.countDocuments(matchStage),
    // ]);

    // const totalPages = Math.ceil(totalCount / limit)

    return {
      data: data as ISubmissionWithUser[],
      totalCount,
      currentPage,
      totalPages,
    };
  }

  public async countPassedByQuizId(
    quizId: string,
    session?: ClientSession,
  ): Promise<number> {
    await this.init();
    const count = await this.submissionResultCollection.countDocuments(
      {quizId, 'gradingResult.gradingStatus': 'PASSED'},
      {session},
    );
    return count;
  }

  async executeBulkSubmissionDelete(
    userId: string,
    attemptIds: string[],
    session?: ClientSession,
  ): Promise<void> {
    await this.init();
    if (!attemptIds.length) return;

    await this.submissionResultCollection.deleteMany(
      {userId, attemptId: {$in: attemptIds}},
      {session},
    );
  }

  public async getAverageScoreByQuizId(
    quizId: string,
    session?: ClientSession,
  ): Promise<number> {
    await this.init();
    const result = await this.submissionResultCollection
      .aggregate([
        {$match: {quizId}},
        {
          $group: {
            _id: null,
            averageScore: {$avg: '$gradingResult.totalScore'},
          },
        },
      ])
      .toArray();

    if (result.length > 0 && result[0].averageScore !== null) {
      return result[0].averageScore;
    }
    return 0;
  }

  async removeByAttemptIds(
    userId: string,
    attemptIds: string[],
    session?: ClientSession,
  ): Promise<void> {
    try {
      await this.init();
      const result = await this.submissionResultCollection.deleteMany(
        {userId, attemptId: {$in: attemptIds}},
        {session},
      );
    } catch (error) {
      throw new InternalServerError(
        `Failed to remove quiz submission /More ${error}`,
      );
    }
  }
}

export {SubmissionRepository};
