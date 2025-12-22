import {IAttempt, IAttemptExport} from '#quizzes/interfaces/grading.js';
import {MongoDatabase} from '#shared/database/providers/mongo/MongoDatabase.js';
import {injectable, inject} from 'inversify';
import {Collection, ClientSession, ObjectId, Document} from 'mongodb';
import {InternalServerError} from 'routing-controllers';
import {GLOBAL_TYPES} from '#root/types.js';
@injectable()
class AttemptRepository {
  private attemptCollection: Collection<IAttempt>;
  private initialized = false;

  constructor(
    @inject(GLOBAL_TYPES.Database)
    private db: MongoDatabase,
  ) {}

  private async init() {
    if (this.initialized) return;

    this.attemptCollection = await this.db.getCollection<IAttempt>(
      'quiz_attempts',
    );

    // High-priority indexes for read performance
    await this.attemptCollection.createIndex(
      {quizId: 1, userId: 1},
      {name: 'quizId_1_userId_1', background: true},
    );
    await this.attemptCollection.createIndex(
      {'questionDetails.questionId': 1},
      {name: 'questionDetails_questionId_1', background: true},
    );
    this.initialized = true;
  }

  async create(attempt: IAttempt, session?: ClientSession) {
    await this.init();
    const result = await this.attemptCollection.insertOne(attempt, {session});
    if (result.acknowledged && result.insertedId) {
      return result.insertedId.toString();
    }
    throw new InternalServerError('Failed to create quiz attempt');
  }
  async getById(
    attemptId: string,
    quizId: string,
    session: ClientSession,
  ): Promise<IAttempt | null> {
    await this.init();

    const quizIdStr = quizId.toString();
    const quizIdObj = new ObjectId(quizIdStr);

    const result = await this.attemptCollection.findOne(
      {
        _id: new ObjectId(attemptId),
        quizId: {$in: [quizIdStr, quizIdObj]},
      },
      {session},
    );
    if (!result) {
      return null;
    }
    return {
      ...result,
      userId: result.userId?.toString(),
      quizId: result.quizId?.toString(),
    };
  }
  async countAttempts(
    quizId: string,
    session?: ClientSession,
  ): Promise<number | null> {
    await this.init();

    const quizIdStr = quizId.toString();
    const quizIdObj = new ObjectId(quizIdStr);

    const result = await this.attemptCollection.countDocuments(
      {quizId: {$in: [quizIdStr, quizIdObj]}},
      {session},
    );
    if (!result) {
      return null;
    }
    return result;
  }

  async countUserAttempts(
    quizId: string,
    userId: string,
    session?: ClientSession,
  ): Promise<number | null> {
    await this.init();

    const quizIdStr = quizId.toString();
    const quizIdObj = new ObjectId(quizIdStr);

    const userIdStr = userId.toString();
    const userIdObj = new ObjectId(userIdStr);

    const result = await this.attemptCollection.countDocuments(
      {
        quizId: {$in: [quizIdStr, quizIdObj]},
        userId: {$in: [userIdStr, userIdObj]},
      },
      {session},
    );
    if (!result) {
      return null;
    }
    return result;
  }

  async update(attemptId: string, updateData: Partial<IAttempt>) {
    await this.init();
    const result = await this.attemptCollection.findOneAndUpdate(
      {_id: new ObjectId(attemptId)},
      {$set: updateData},
      {returnDocument: 'after'},
    );
    return result;
  }

  async countByQuestionId(
    questionId: string,
    session?: ClientSession,
  ): Promise<number> {
    await this.init();
    const filter = {
      'questionDetails.questionId': {
        $in: [questionId, new ObjectId(questionId)],
      },
    } as any;
    const count = await this.attemptCollection.countDocuments(filter, {
      session,
    });
    return count;
  }

  async countDistinctUsersByQuestionId(
    questionId: string,
    session?: ClientSession,
  ): Promise<number> {
    await this.init();
    const filter = {
      'questionDetails.questionId': {
        $in: [questionId, new ObjectId(questionId)],
      },
    } as any;
    const distinctUsers = await this.attemptCollection.distinct(
      'userId',
      filter,
      {session},
    );
    return distinctUsers.length;
  }

  async getAttemptsByQuizId(
    quizId: string,
    session?: ClientSession,
  ): Promise<IAttemptExport[]> {
    await this.init();

    const pipeline = [
      {
        $match: {
          quizId: new ObjectId(quizId),
        },
      },
      {
        // Lookup all questions used by this attempt
        $lookup: {
          from: 'questions',
          localField: 'answers.questionId',
          foreignField: '_id',
          as: 'questionDocs',
        },
      },
      {
        $lookup:
          /**
           * from: The target collection.
           * localField: The local join field.
           * foreignField: The target join field.
           * as: The name for the results.
           * pipeline: Optional pipeline to run on the foreign collection.
           * let: Optional variables to use in the pipeline field stages.
           */
          {
            from: 'users',
            localField: 'userId',
            foreignField: '_id',
            as: 'user',
          },
      },
      {
        $lookup: {
          from: 'questions',
          localField: 'questionDetails.questionId',
          foreignField: '_id',
          as: 'questionDetails',
        },
      },
      {
        $set:
          /**
           * field: The field name
           * expression: The expression.
           */
          {
            user: {
              $arrayElemAt: ['$user', 0],
            },
          },
      },
      {
        // Merge questions back into each answers[i]
        $addFields: {
          answers: {
            $map: {
              input: '$answers',
              as: 'ans',
              in: {
                $mergeObjects: [
                  '$$ans',
                  {
                    question: {
                      $arrayElemAt: [
                        {
                          $filter: {
                            input: '$questionDocs',
                            as: 'qd',
                            cond: {
                              $eq: ['$$qd._id', '$$ans.questionId'],
                            },
                          },
                        },
                        0,
                      ],
                    },
                  },
                ],
              },
            },
          },
        },
      },
      {
        // Remove temporary data
        $project: {
          questionDocs: 0,
        },
      },
    ];

    const attempts = await this.attemptCollection
      .aggregate(pipeline, {session})
      .toArray();

    return attempts as IAttemptExport[];
  }
}

export {AttemptRepository};
