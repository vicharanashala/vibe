import {IQuestionStruggleStreak} from '#quizzes/interfaces/struggle.js';
import {MongoDatabase} from '#root/shared/database/providers/mongo/MongoDatabase.js';
import {GLOBAL_TYPES} from '#root/types.js';
import {injectable, inject} from 'inversify';
import {Collection, ClientSession, ObjectId} from 'mongodb';

/** Which student, question and course version a streak belongs to. */
interface StreakKey {
  userId: string;
  courseId: string;
  courseVersionId: string;
  cohortId?: string;
  questionId: string;
  quizId: string;
}

/**
 * Failure streaks per student and question (#1109). Every change is a single
 * atomic update, so two quiz submissions arriving together can neither lose
 * a failure nor send two alerts for the same streak.
 */
@injectable()
class StruggleStreakRepository {
  private collection: Collection<IQuestionStruggleStreak>;
  private initialized = false;

  constructor(
    @inject(GLOBAL_TYPES.Database)
    private db: MongoDatabase,
  ) {}

  private async init() {
    if (this.initialized) {
      return;
    }
    this.collection = await this.db.getCollection<IQuestionStruggleStreak>(
      'question_struggle_streaks',
    );
    await this.collection.createIndex(
      {userId: 1, courseVersionId: 1, questionId: 1},
      {unique: true},
    );
    this.initialized = true;
  }

  private filter(key: StreakKey) {
    return {
      userId: new ObjectId(key.userId),
      courseVersionId: new ObjectId(key.courseVersionId),
      questionId: new ObjectId(key.questionId),
    };
  }

  /** Adds one wrong answer to the streak and returns the updated streak. */
  async recordFailure(
    key: StreakKey,
    now: Date,
    session?: ClientSession,
  ): Promise<IQuestionStruggleStreak> {
    await this.init();
    const updated = await this.collection.findOneAndUpdate(
      this.filter(key),
      {
        $inc: {consecutiveFailures: 1},
        $set: {
          quizId: new ObjectId(key.quizId),
          ...(key.cohortId ? {cohortId: new ObjectId(key.cohortId)} : {}),
          lastAttemptAt: now,
        },
        $setOnInsert: {
          courseId: new ObjectId(key.courseId),
          alertedAt: null,
          createdAt: now,
        },
      },
      {upsert: true, returnDocument: 'after', session},
    );
    return updated!;
  }

  /** A correct answer ends the streak, so a new one starts from zero. */
  async recordSuccess(
    key: StreakKey,
    now: Date,
    session?: ClientSession,
  ): Promise<void> {
    await this.init();
    await this.collection.updateOne(
      {...this.filter(key), consecutiveFailures: {$gt: 0}},
      {$set: {consecutiveFailures: 0, alertedAt: null, lastAttemptAt: now}},
      {session},
    );
  }

  /**
   * Marks the streak as alerted, but only if it has reached `threshold` and
   * nobody has alerted for it yet. Returns true for exactly one caller per
   * streak, which is the one that sends the alert.
   */
  async claimAlert(
    streakId: ObjectId,
    threshold: number,
    now: Date,
    session?: ClientSession,
  ): Promise<boolean> {
    await this.init();
    const result = await this.collection.updateOne(
      {
        _id: streakId,
        alertedAt: null,
        consecutiveFailures: {$gte: threshold},
      },
      {$set: {alertedAt: now}},
      {session},
    );
    return result.modifiedCount === 1;
  }
}

export {StruggleStreakRepository, StreakKey};
