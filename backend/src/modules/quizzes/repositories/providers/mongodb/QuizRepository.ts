import {QuizItem} from '#courses/classes/transformers/Item.js';
import {IQuestionBankRef} from '#root/shared/index.js';
import {GLOBAL_TYPES} from '#root/types.js';
import {MongoDatabase} from '#shared/database/providers/mongo/MongoDatabase.js';
import {injectable, inject} from 'inversify';
import {Collection, ClientSession, ObjectId} from 'mongodb';
import {InternalServerError} from 'routing-controllers';

@injectable()
class QuizRepository {
  private quizCollection: Collection<QuizItem>;

  constructor(
    @inject(GLOBAL_TYPES.Database)
    private db: MongoDatabase,
  ) {}

  private async init() {
    this.quizCollection = await this.db.getCollection<QuizItem>('quizzes');
  }

  async getById(
    quizId: string,
    session?: ClientSession,
  ): Promise<QuizItem | null> {
    await this.init();
    const result = await this.quizCollection.findOne(
      {_id: new ObjectId(quizId)},
      {session},
    );

    if (!result) {
      return null;
    }
    return {
      ...result,
      details: {
        ...result.details,
        questionBankRefs: (result.details?.questionBankRefs ?? []).map(
          (ref: IQuestionBankRef) => {
            return {
              ...ref,
              bankId: ref.bankId.toString(),
            };
          },
        ),
      },
    };
  }

  async getByIds(
    quizId: string[],
    session?: ClientSession,
  ): Promise<null | QuizItem[]> {
    await this.init();
    const objectIds = quizId.map(id => new ObjectId(id));
    const quizItems = await this.quizCollection
      .find({_id: {$in: objectIds}}, {session})
      .toArray();

    if (!quizItems.length) {
      return null;
    }

    return quizItems.map(item => ({
      ...item,
      details: {
        ...item.details,
        questionBankRefs: (item.details?.questionBankRefs ?? []).map(
          (ref: any) => ({
            ...ref,
            bankId: ref.bankId.toString(),
          }),
        ),
      },
    }));
  }

  async updateQuiz(quiz: QuizItem, session?: ClientSession): Promise<QuizItem> {
    await this.init();
    const result = await this.quizCollection.findOneAndUpdate(
      {_id: new ObjectId(quiz._id)},
      {$set: quiz},
      {returnDocument: 'after', session},
    );
    if (!result) {
      return null;
    }
    return result;
  }

  async bulkConvertIds(batchSize = 100): Promise<{updated: number}> {
    try {
      await this.init();

      const cursor = this.quizCollection.find(
        {},
        {
          projection: {_id: 1, details: 1},
        },
      );

      let bulkOps: any[] = [];
      let totalUpdated = 0;

      while (await cursor.hasNext()) {
        const quiz = await cursor.next();
        if (!quiz) continue;

        let needsUpdate = false;
        const updatedDetails = {...(quiz.details || {})};

        if (Array.isArray(updatedDetails.questionBankRefs)) {
          updatedDetails.questionBankRefs = updatedDetails.questionBankRefs.map(
            (ref: IQuestionBankRef) => {
              if (ref?.bankId && typeof ref.bankId === 'string') {
                needsUpdate = true;
                return {...ref, bankId: new ObjectId(ref.bankId)};
              }
              return ref;
            },
          );
        }

        if (needsUpdate) {
          bulkOps.push({
            updateOne: {
              filter: {_id: quiz._id},
              update: {$set: {details: updatedDetails}},
            },
          });
        }

        if (bulkOps.length >= batchSize) {
          const result = await this.quizCollection.bulkWrite(bulkOps);
          totalUpdated += result.modifiedCount;
          bulkOps = [];
        }
      }

      if (bulkOps.length > 0) {
        const result = await this.quizCollection.bulkWrite(bulkOps);
        totalUpdated += result.modifiedCount;
      }

      return {updated: totalUpdated};
    } catch (error) {
      throw new InternalServerError(
        `Failed quizzes details.questionBankRefs ID conversion. More/ ${error}`,
      );
    }
  }
}

export {QuizRepository};
