import {
  BaseQuestion,
  FlaggedQuestion,
} from '#quizzes/classes/transformers/Question.js';
import {MongoDatabase} from '#shared/index.js';
import {injectable, inject} from 'inversify';
import {Collection, ClientSession, ObjectId, Document} from 'mongodb';
import {InternalServerError} from 'routing-controllers';
import {GLOBAL_TYPES} from '#root/types.js';

@injectable()
class QuestionRepository {
  private questionCollection: Collection<BaseQuestion>;
  private flaggedQuestionCollection: Collection<FlaggedQuestion>;

  constructor(
    @inject(GLOBAL_TYPES.Database)
    private db: MongoDatabase,
  ) {}

  private async init() {
    this.questionCollection =
      await this.db.getCollection<BaseQuestion>('questions');
    this.flaggedQuestionCollection =
      await this.db.getCollection<FlaggedQuestion>('flagged_questions');
  }

  public async create(
    question: BaseQuestion,
    session?: ClientSession,
  ): Promise<string | null> {
    await this.init();
    const result = await this.questionCollection.insertOne(question);
    if (result.acknowledged && result.insertedId) {
      return result.insertedId.toString();
    }
  }
  public async getById(
    questionId: string | ObjectId,
    session?: ClientSession,
  ): Promise<BaseQuestion | null> {
    await this.init();
    const result = await this.questionCollection.findOne(
      {_id: new ObjectId(questionId)},
      {session},
    );
    return result;
  }

  public async getByIdWithoutExplanation(
    questionId: string,
    session?: ClientSession,
  ): Promise<BaseQuestion | null> {
    await this.init();

    const result = await this.questionCollection.findOne(
      {_id: new ObjectId(questionId)},
      {
        projection: {
          'correctLotItem.explaination': 0,
          'incorrectLotItems.explaination': 0,
          'correctLotItems.explaination': 0,
          'ordering.lotItem.explaination': 0,
        },
        session,
      },
    );

    return result;
  }

  public async getByIds(
    questionIds: string[],
    session?: ClientSession,
  ): Promise<BaseQuestion[]> {
    await this.init();
    const objectIds = questionIds.map(id => new ObjectId(id));
    const results = await this.questionCollection
      .find({_id: {$in: objectIds}}, {session})
      .toArray();
    return results;
  }
  public async update(
    questionId: string,
    updateData: Partial<BaseQuestion>,
    session?: ClientSession,
  ): Promise<BaseQuestion | null> {
    await this.init();
    const result = await this.questionCollection.findOneAndUpdate(
      {_id: new ObjectId(questionId)},
      {$set: updateData},
      {returnDocument: 'after', session},
    );
    if (!result) {
      return null;
    }
    return result;
  }
  public async delete(
    questionId: string,
    session?: ClientSession,
  ): Promise<boolean> {
    await this.init();
    // Soft delete implementation
    const result = await this.questionCollection.updateOne(
      {_id: new ObjectId(questionId)},
      {$set: {isDeleted: true, deletedAt: new Date()}},
      {session},
    );
    return result.modifiedCount === 1;
  }
  public async duplicate(
    questionId: string,
    session?: ClientSession,
  ): Promise<BaseQuestion | null> {
    await this.init();
    const question = await this.getById(questionId, session);
    const newQuestion = {...question, _id: undefined}; // Create a copy without the _id
    const result = await this.questionCollection.insertOne(newQuestion, {
      session,
    });
    if (result.acknowledged && result.insertedId) {
      return {...newQuestion, _id: result.insertedId.toString()};
    }
    throw new InternalServerError('Failed to duplicate question');
  }

  public async flagQuestion(
    questionId: string,
    userId: string,
    reason: string,
    session?: ClientSession,
    courseId?: string,
    versionId?: string,
  ): Promise<string> {
    await this.init();
    const flaggedQuestion = new FlaggedQuestion(
      questionId,
      userId,
      reason,
      courseId,
      versionId,
    );
    const result = await this.flaggedQuestionCollection.insertOne(
      flaggedQuestion,
      {session},
    );
    if (result.acknowledged && result.insertedId) {
      return result.insertedId.toString();
    }
    throw new InternalServerError('Failed to flag question');
  }

  public async getFlaggedQuestionById(
    flagId: string,
    session?: ClientSession,
  ): Promise<FlaggedQuestion | null> {
    await this.init();
    const result = await this.flaggedQuestionCollection.findOne(
      {_id: new ObjectId(flagId)},
      {session},
    );
    return result;
  }

  public async updateFlaggedQuestion(
    flagId: string,
    updateData: Partial<FlaggedQuestion>,
    session?: ClientSession,
  ): Promise<FlaggedQuestion | null> {
    await this.init();
    const result = await this.flaggedQuestionCollection.findOneAndUpdate(
      {_id: new ObjectId(flagId)},
      {$set: updateData},
      {returnDocument: 'after', session},
    );
    if (!result) {
      return null;
    }
    return result;
  }

  public async getLotItemInfo(
    LotItemIds: string[],
    session?: ClientSession,
  ): Promise<Document> {
    await this.init();

    const objectIds = LotItemIds.map(id => new ObjectId(id));

    const pipeline = [
      {
        $match: {
          $or: [
            {
              'incorrectLotItems._id': {
                $in: objectIds,
              },
            },
            {
              'correctLotItem._id': {
                $in: objectIds,
              },
            },
          ],
        },
      },
      {
        $addFields: {
          matchedIncorrectItem: {
            $first: {
              $filter: {
                input: '$incorrectLotItems',
                cond: {
                  $in: ['$$this._id', objectIds],
                },
              },
            },
          },
          matchedCorrectItem: {
            $cond: [
              {
                $in: ['$correctLotItem._id', objectIds],
              },
              '$correctLotItem',
              null,
            ],
          },
        },
      },
      {
        $addFields:
          /**
           * newField: The new field name.
           * expression: The new field expression.
           */
          {
            lotItemId: {
              $ifNull: [
                '$matchedCorrectItem._id',
                '$matchedIncorrectItem._id', // or any way to pick one
              ],
            },
          },
      },
    ];

    const results = await this.questionCollection
      .aggregate(pipeline, {session})
      .toArray();

    return results;
  }

  public async updatePoints(
    questionId: string,
    points: number,
    session?: ClientSession,
  ): Promise<boolean> {
    await this.init();
    const result = await this.questionCollection.updateOne(
      {_id: new ObjectId(questionId)},
      {$set: {points}},
      {session},
    );
    return result.modifiedCount === 1;
  }
}

export {QuestionRepository};
