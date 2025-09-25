import {
  Answer,
  IAttempt,
  IOrder,
  IQuestionAnswer,
  IQuestionDetails,
} from '#quizzes/interfaces/grading.js';
import {MongoDatabase} from '#shared/database/providers/mongo/MongoDatabase.js';
import {injectable, inject} from 'inversify';
import {Collection, ClientSession, ObjectId} from 'mongodb';
import {InternalServerError} from 'routing-controllers';
import {GLOBAL_TYPES} from '#root/types.js';
import {ID} from '#root/shared/index.js';
@injectable()
class AttemptRepository {
  private attemptCollection: Collection<IAttempt>;
  constructor(
    @inject(GLOBAL_TYPES.Database)
    private db: MongoDatabase,
  ) {}

  private async init() {
    this.attemptCollection = await this.db.getCollection<IAttempt>(
      'quiz_attempts',
    );
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
      questionDetails:
        result.questionDetails?.map((qd: IQuestionDetails) => ({
          ...qd,
          questionId: qd.questionId?.toString(),
        })) ?? [],
      answers:
        result.answers?.map((ans: IQuestionAnswer) => {
          let answer = ans.answer;

          if ('lotItemId' in answer) {
            answer = {
              ...answer,
              lotItemId: answer.lotItemId?.toString(),
            };
          } else if ('lotItemIds' in answer) {
            answer = {
              ...answer,
              lotItemIds: answer.lotItemIds?.map((id: ID) => id?.toString()),
            };
          } else if ('orders' in answer) {
            answer = {
              ...answer,
              orders: answer.orders.map((o: IOrder) => ({
                ...o,
                lotItemId: o.lotItemId?.toString(),
              })),
            };
          }

          return {
            ...ans,
            questionId: ans.questionId?.toString(),
            answer,
          };
        }) ?? [],
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

  async bulkConvertIds(): Promise<{updated: number}> {
    try {
      await this.init();

      const attemptDocs = await this.attemptCollection
        .find()
        .project({
          _id: 1,
          quizId: 1,
          userId: 1,
          questionDetails: 1,
          answers: 1,
          isSkipped: 1,
          createdAt: 1,
          updatedAt: 1,
        })
        .toArray();

      if (!attemptDocs.length) return {updated: 0};

      const bulkOperations = attemptDocs
        .map((attempt: IAttempt) => {
          let needsUpdate = false;

          // Convert quizId
          let updatedQuizId = attempt.quizId;
          if (attempt.quizId && typeof attempt.quizId === 'string') {
            updatedQuizId = new ObjectId(attempt.quizId);
            needsUpdate = true;
          }

          // Convert userId
          let updatedUserId = attempt.userId;
          if (attempt.userId && typeof attempt.userId === 'string') {
            updatedUserId = new ObjectId(attempt.userId);
            needsUpdate = true;
          }

          const updatedQuestionDetails = (attempt.questionDetails || []).map(
            (qd: IQuestionDetails) => {
              let newQD: IQuestionDetails = {...qd};
              if (qd?.questionId && typeof qd.questionId === 'string') {
                newQD.questionId = new ObjectId(qd.questionId);
                needsUpdate = true;
              }
              return newQD;
            },
          );

          const updatedAnswers = (attempt.answers || []).map(
            (ans: IQuestionAnswer) => {
              let newAnswer: Answer = {...ans.answer};

              if ('lotItemId' in newAnswer && newAnswer.lotItemId) {
                if (typeof newAnswer.lotItemId === 'string') {
                  newAnswer = {
                    ...newAnswer,
                    lotItemId: new ObjectId(newAnswer.lotItemId),
                  };
                  needsUpdate = true;
                }
              } else if (
                'lotItemIds' in newAnswer &&
                Array.isArray(newAnswer.lotItemIds)
              ) {
                newAnswer = {
                  ...newAnswer,
                  lotItemIds: newAnswer.lotItemIds.map(id =>
                    typeof id === 'string' ? new ObjectId(id) : id,
                  ),
                };
                needsUpdate = true;
              } else if (
                'orders' in newAnswer &&
                Array.isArray(newAnswer.orders)
              ) {
                newAnswer = {
                  ...newAnswer,
                  orders: newAnswer.orders.map(o => ({
                    ...o,
                    lotItemId:
                      typeof o.lotItemId === 'string'
                        ? new ObjectId(o.lotItemId)
                        : o.lotItemId,
                  })),
                };
                needsUpdate = true;
              }

              const updatedQId =
                typeof ans.questionId === 'string'
                  ? new ObjectId(ans.questionId)
                  : ans.questionId;

              if (typeof ans.questionId === 'string') needsUpdate = true;

              return {
                ...ans,
                questionId: updatedQId,
                answer: newAnswer,
              };
            },
          );

          if (needsUpdate) {
            return {
              updateOne: {
                filter: {_id: attempt._id},
                update: {
                  $set: {
                    quizId: updatedQuizId,
                    userId: updatedUserId,
                    questionDetails: updatedQuestionDetails,
                    answers: updatedAnswers,
                  },
                },
              },
            };
          }

          return null;
        })
        .filter(Boolean);

      if (!bulkOperations.length) return {updated: 0};

      const result = await this.attemptCollection.bulkWrite(bulkOperations);
      return {updated: result.modifiedCount};
    } catch (error) {
      throw new InternalServerError(
        `Failed attempts ID conversion. More/ ${error}`,
      );
    }
  }
}

export {AttemptRepository};
