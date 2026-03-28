import {MongoDatabase} from '#shared/database/providers/mongo/MongoDatabase.js';
import {IQuestionBank} from '#shared/interfaces/quiz.js';
import {GLOBAL_TYPES} from '#root/types.js';
import {injectable, inject} from 'inversify';
import {Collection, ClientSession, ObjectId} from 'mongodb';

@injectable()
class QuestionBankRepository {
  private questionBankCollection: Collection<IQuestionBank>;
  private questionsCollection: Collection<any>;

  constructor(
    @inject(GLOBAL_TYPES.Database)
    private db: MongoDatabase,
  ) {}

  private async init() {
    this.questionBankCollection = await this.db.getCollection<IQuestionBank>(
      'questionBanks',
    );

    this.questionsCollection = await this.db.getCollection<any>('questions');

    // High-priority indexes for read performance
    await this.questionBankCollection.createIndex(
      {questions: 1},
      {name: 'questions_1', background: true},
    );
    await this.questionBankCollection.createIndex(
      {courseVersionId: 1},
      {name: 'courseVersionId_1', background: true},
    );
  }

  async create(
    questionBank: IQuestionBank,
    session?: ClientSession,
  ): Promise<string> {
    await this.init();
    const result = await this.questionBankCollection.insertOne(questionBank, {
      session,
    });
    if (result.acknowledged && result.insertedId) {
      return result.insertedId.toString();
    }
    throw new Error('Failed to create question bank');
  }

  async getById(
    questionBankId: string,
    session?: ClientSession,
  ): Promise<IQuestionBank | null> {
    await this.init();
    // Ensure that we do not fetch deleted question banks and questions that are soft deleted
    const result = await this.questionBankCollection.findOne(
      {_id: new ObjectId(questionBankId), isDeleted: {$ne: true}},
      {session},
    );
    if (!result) {
      return null;
    }

    // Lookup result.questions against questions collections.
    // Filter those questions that are soft deleted.

    const questionObjectIds = result.questions.map(qId => new ObjectId(qId));

    const questions = await this.questionsCollection
      .find({_id: {$in: questionObjectIds}, isDeleted: {$ne: true}}, {session})
      .toArray();

    result.questions = questions.map(q => q._id);

    return {
      ...result,
      questions: result.questions.map(question => question.toString()),
      courseId: result.courseId?.toString(),
      courseVersionId: result.courseVersionId?.toString(),
    };
  }

  async removeQuestionFromAllBanks(
    questionId: string,
    session?: ClientSession,
  ): Promise<number> {
    await this.init();

    const result = await this.questionBankCollection.updateMany(
      {questions: new ObjectId(questionId)},
      {$pull: {questions: new ObjectId(questionId)}},
      {session},
    );

    return result.modifiedCount; // number of banks updated
  }

  async update(
    questionBankId: string,
    updateData: Partial<IQuestionBank>,
    session?: ClientSession,
  ): Promise<IQuestionBank | null> {
    await this.init();
    const result = await this.questionBankCollection.findOneAndUpdate(
      {_id: new ObjectId(questionBankId)},
      {$set: updateData},
      {returnDocument: 'after', session},
    );
    if (!result) {
      return null;
    }
    result._id = result._id.toString(); // Convert ObjectId to string
    return result;
  }

  async delete(
    questionBankId: string,
    session?: ClientSession,
  ): Promise<boolean> {
    await this.init();
    // soft delete implementation
    const questionBank = await this.questionBankCollection.findOne(
      {_id: new ObjectId(questionBankId)},
      {session},
    );

    if (!questionBank) {
      return false;
    }

    const result = await this.questionBankCollection.updateOne(
      {_id: new ObjectId(questionBankId)},
      {$set: {isDeleted: true, deletedAt: new Date()}},
      {session},
    );

    const questionObjectIds = questionBank.questions.map(
      qId => new ObjectId(qId),
    );

    // Soft delete related questions in questions collection
    await this.questionsCollection.updateMany(
      {_id: {$in: questionObjectIds}},
      {$set: {isDeleted: true, deletedAt: new Date()}},
      {session},
    );
    return result.modifiedCount > 0;
  }

  async getQuestionBanksByQuestionId(
    questionId: string | ObjectId,
    session?: ClientSession,
  ): Promise<IQuestionBank[]> {
    await this.init();
    const query = {
      $or: [{questions: new ObjectId(questionId)}, {questions: questionId}],
    };
    // const result = await this.questionBankCollection
    //   .find({questions: new ObjectId(questionId)}, {session})
    //   .toArray();
    const results = await this.questionBankCollection
      .find(query, {session})
      .toArray();

    if (!results.length) {
      return null;
    }

    // Normalize courseId and courseVersionId
    return results.map(bank => ({
      ...bank,
      questions: bank.questions.map(qn => qn.toString()),
      courseId: bank.courseId?.toString(),
      courseVersionId: bank.courseVersionId?.toString(),
    }));
  }

  async deleteQuestionBankByVersionId(
    versionId: string,
    session?: ClientSession,
  ): Promise<boolean> {
    await this.init();
    const result = await this.questionBankCollection.deleteMany(
      {courseVersionId: new ObjectId(versionId)},
      {session},
    );
    return result.deletedCount > 0;
  }

  async updateQuestionsPoints(
    questionBankId: string,
    points: number,
    session?: ClientSession,
  ): Promise<number> {
    await this.init();
    const questionBank = await this.questionBankCollection.findOne(
      {_id: new ObjectId(questionBankId)},
      {session},
    );
    if (!questionBank) {
      return 0;
    }

    const questionObjectIds = questionBank.questions.map(
      qId => new ObjectId(qId),
    );

    const result = await this.questionsCollection.updateMany(
      {_id: {$in: questionObjectIds}, isDeleted: {$ne: true}},
      {$set: {points}},
      {session},
    );

    return result.modifiedCount;
  }
}

export {QuestionBankRepository};
