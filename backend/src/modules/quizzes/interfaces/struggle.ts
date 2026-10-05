import {ObjectId} from 'mongodb';

/**
 * A student's current run of wrong answers to one quiz question (#1109).
 * One document per student, question and course version.
 */
interface IQuestionStruggleStreak {
  _id?: ObjectId;
  userId: ObjectId;
  courseId: ObjectId;
  courseVersionId: ObjectId;
  cohortId?: ObjectId;
  questionId: ObjectId;
  /** The quiz the question was last answered in. */
  quizId: ObjectId;
  /** Wrong (or partly wrong) answers in a row; reset by a correct answer. */
  consecutiveFailures: number;
  /** When instructors were alerted for the current streak; null if not yet. */
  alertedAt: Date | null;
  lastAttemptAt: Date;
  createdAt: Date;
}

/** Wrong answers in a row that count as struggling. */
const STRUGGLE_THRESHOLD = 3;

export {IQuestionStruggleStreak, STRUGGLE_THRESHOLD};
