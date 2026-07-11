import {MongoDatabase} from '#shared/database/providers/mongo/MongoDatabase.js';
import {IQuestionBank} from '#shared/interfaces/quiz.js';
import {GLOBAL_TYPES} from '#root/types.js';
import {injectable, inject} from 'inversify';
import {Collection, ClientSession, ObjectId} from 'mongodb';

@injectable()
class QuestionBankRepository {
  private questionBankCollection: Collection<IQuestionBank>;
  private questionsCollection: Collection<any>;
  private initialized = false;

  constructor(
    @inject(GLOBAL_TYPES.Database)
    private db: MongoDatabase,
  ) {}

  private async init() {
    if (this.initialized) return;

    this.questionBankCollection = await this.db.getCollection<IQuestionBank>('questionBanks');
    this.questionsCollection = await this.db.getCollection<any>('questions');

    // Ensure indexes exist for the most frequent read patterns.
    // `background: true` prevents the creation from blocking other operations
    // on the collection while the index is being built.
    await this.questionBankCollection.createIndex(
      { questions: 1 },
      { name: 'questions_1', background: true },
    );
    await this.questionBankCollection.createIndex(
      { courseVersionId: 1 },
      { name: 'courseVersionId_1', background: true },
    );

    this.initialized = true;
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

  /**
   * Find the crowd "Submitted – Pending Validation" bank for a given graded
   * bank (keyed by sourceGradedBankId). Returns null if none exists yet.
   */
  async findCrowdSubmittedBankByGradedBankId(
    gradedBankId: string,
    session?: ClientSession,
  ): Promise<IQuestionBank | null> {
    await this.init();
    return this.questionBankCollection.findOne(
      {
        crowdSubmitted: true,
        sourceGradedBankId: new ObjectId(gradedBankId),
        isDeleted: {$ne: true},
      },
      {session},
    );
  }

  async getById(
    questionBankId: string,
    session?: ClientSession,
  ): Promise<IQuestionBank | null> {
    await this.init();

    const result = await this.questionBankCollection.findOne(
      { _id: new ObjectId(questionBankId), isDeleted: { $ne: true } },
      { session },
    );

    if (!result) return null;

    // Re-query the questions collection to filter out any questions that were
    // soft-deleted after they were added to the bank.  The bank document
    // stores question references as ObjectIds, so we convert here.
    const questionObjectIds = result.questions.map(qId => new ObjectId(qId));
    const activeQuestions = await this.questionsCollection
      .find({ _id: { $in: questionObjectIds }, isDeleted: { $ne: true } }, { session })
      .toArray();

    result.questions = activeQuestions.map(q => q._id);

    return {
      ...result,
      questions: result.questions.map(q => q.toString()),
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

    // Query for both ObjectId and string forms in case the stored type varies
    // across older and newer documents in the collection.
    const query = {
      $or: [{ questions: new ObjectId(questionId) }, { questions: questionId }],
    };
    const results = await this.questionBankCollection
      .find(query, { session })
      .toArray();

    if (!results.length) return null;

    return results.map(bank => ({
      ...bank,
      questions: bank.questions.map(qn => qn.toString()),
      courseId: bank.courseId?.toString(),
      courseVersionId: bank.courseVersionId?.toString(),
    }));
  }

  /**
   * Returns all non-deleted question banks that contain at least one of the
   * given question IDs.
   *
   * This is the batch variant of {@link getQuestionBanksByQuestionId}.  It is
   * used by the ACRE pipeline after a quiz submission to resolve the concept
   * tags associated with every incorrectly answered question in a single
   * database round-trip — rather than issuing one query per question.
   *
   * The query covers both ObjectId and string representations of each ID
   * because the stored type may differ across older and newer documents.
   *
   * @param questionIds - The question IDs to look up.  May be strings or
   *   ObjectIds; both forms are queried simultaneously.
   * @param session - Optional MongoDB session for transactional reads.
   * @returns An array of matching question banks with normalised string IDs.
   *   Returns an empty array when no banks contain any of the given IDs.
   */
  async getQuestionBanksByQuestionIds(
    questionIds: (string | ObjectId)[],
    session?: ClientSession,
  ): Promise<IQuestionBank[]> {
    await this.init();

    const objectIds = questionIds.map(id => new ObjectId(id));
    const stringIds = questionIds.map(id => id.toString());

    // Include both forms in the $in clause to handle documents where the
    // `questions` array stores ObjectIds in some entries and strings in others.
    const results = await this.questionBankCollection
      .find(
        { questions: { $in: [...objectIds, ...stringIds] }, isDeleted: { $ne: true } },
        { session },
      )
      .toArray();

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
