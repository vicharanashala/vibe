import { injectable, inject } from 'inversify';
import { Collection, ClientSession } from 'mongodb';
import { GLOBAL_TYPES } from '#root/types.js';
import { MongoDatabase } from '#shared/database/providers/mongo/MongoDatabase.js';

/**
 * Owns reads + writes to the `motivation_opt_outs` collection from within
 * the motivation module. Per Pillar 3 of PLAN_MOTIVATION_SYSTEM.md:
 *
 *   "Public opt-out for high-retention students. The rule: new students
 *    (just completed a course, no retention data) are on the leaderboard
 *    by default and cannot opt out. High-retention students can opt out
 *    per course. Threshold: 30-day retention ≥ 90% AND reviews in 30-day
 *    window ≥ 100."
 *
 * The threshold check lives in the controller / service (it needs
 * ReviewItem data and the retention computation), NOT here. This repo
 * is a thin storage adapter; the gate is enforced upstream by the
 * opt-out endpoint, which calls `setOptOut()` only after verifying
 * the student's retention meets the bar.
 *
 * Storage shape:
 *   { _id: ObjectId, studentId: string, courseId: string, optedOutAt: Date }
 *
 * Indexes (created lazily on first init via MongoDatabase.ensureIndexes):
 *   - (studentId, courseId) UNIQUE  — one opt-out doc per (student, course)
 *   - (courseId, studentId)          — bulk lookup of "who opted out of X"
 *
 * The first index is unique so a duplicate setOptOut(true) becomes a
 * no-op rather than a race-prone double-write. The second index is
 * for the leaderboard endpoint's per-course bulk fetch.
 *
 * Added 2026-07-25 for Pillar 3 (Day 4 of motivation build order).
 */
@injectable()
class OptOutRepository {
  private optOutsCollection: Collection<OptOutDoc>;

  constructor(
    @inject(GLOBAL_TYPES.Database)
    private db: MongoDatabase,
  ) {}

  private async init(): Promise<void> {
    if (!this.optOutsCollection) {
      this.optOutsCollection = await this.db.getCollection<OptOutDoc>(
        'motivation_opt_outs',
      );
    }
  }

  /**
   * Mark (or unmark) a student as opted out of a course's leaderboard.
   *
   *   - `optedOut = true`: upsert with $set on (studentId, courseId),
   *     stamping `optedOutAt` to now. Idempotent — repeated calls just
   *     refresh the timestamp.
   *   - `optedOut = false`: deleteOne on (studentId, courseId). No
   *     tombstone, no audit trail — coming back is the absence of a
   *     doc, not a "optedOutAt: null" sentinel.
   *
   * Returns:
   *   - `changed: true` if the user's opt-out *state* changed —
   *     i.e. the doc was newly created (first opt-in) or removed
   *     (first opt-out-of-an-opt-out). Repeated ops that just refresh
   *     the timestamp report `changed: false`.
   *   - `optedOutAt`: timestamp of the upserted doc, or null when
   *     opting back in (the doc no longer exists, so there is no
   *     timestamp to surface). Always returned on opt-in so the
   *     controller can echo the most recent opt-in time even on
   *     no-op upserts.
   *
   * Callers in the controller use `changed` to decide whether to toast
   * "you've opted out" vs "you were already opted out", and pass
   * `optedOutAt` straight into the response payload.
   *
   * Implementation note: $set with a fresh Date on every call always
   * modifies the doc, so `modifiedCount` would be 1 even on no-ops.
   * We deliberately read `upsertedCount` only — a doc is "new" iff
   * it didn't exist before, which is the only event the user
   * perceives as "I just opted out". Coming back from a state of
   * "not opted out" is also `changed: false` (deleteOne's deletedCount
   * is 0 when there was nothing to delete).
   */
  async setOptOut(
    studentId: string,
    courseId: string,
    optedOut: boolean,
    session?: ClientSession,
  ): Promise<{ changed: boolean; optedOutAt: Date | null }> {
    await this.init();
    if (optedOut) {
      const optedOutAt = new Date();
      const result = await this.optOutsCollection.updateOne(
        { studentId, courseId },
        { $set: { studentId, courseId, optedOutAt } },
        { upsert: true, ...(session ? { session } : {}) },
      );
      return {
        changed: result.upsertedCount > 0,
        optedOutAt,
      };
    }
    const result = await this.optOutsCollection.deleteOne(
      { studentId, courseId },
      { ...(session ? { session } : {}) },
    );
    return {
      changed: result.deletedCount > 0,
      optedOutAt: null,
    };
  }

  /**
   * Read whether a single student has opted out of a specific course.
   * Returns true iff a doc exists for (studentId, courseId).
   */
  async getOptOutForCourse(
    studentId: string,
    courseId: string,
  ): Promise<boolean> {
    await this.init();
    const doc = await this.optOutsCollection.findOne(
      { studentId, courseId },
      { projection: { _id: 1 } },
    );
    return doc !== null;
  }

  /**
   * Return the set of `courseId`s a student has opted out of.
   * Used by the opt-out banner on the leaderboard to know which
   * courses to render the "you're off the leaderboard" variant
   * vs the "you've earned the right" variant.
   */
  async getOptOutsForStudent(studentId: string): Promise<string[]> {
    await this.init();
    const docs = await this.optOutsCollection
      .find(
        { studentId },
        { projection: { courseId: 1, _id: 0 } },
      )
      .toArray();
    return docs.map((d) => d.courseId);
  }

  /**
   * Bulk-fetch opted-out students for a single course.
   * Returns a Set of studentId (firebaseUID) for O(1) `has()` checks
   * while building the leaderboard response.
   *
   * Used by the leaderboard endpoint to populate `isOptedOut: boolean`
   * on each row in one round trip instead of N point reads.
   */
  async getOptOutsForCourse(courseId: string): Promise<Set<string>> {
    await this.init();
    const docs = await this.optOutsCollection
      .find(
        { courseId },
        { projection: { studentId: 1, _id: 0 } },
      )
      .toArray();
    return new Set(docs.map((d) => d.studentId));
  }
}

/**
 * Internal document shape. Not exported — callers go through the
 * repo methods, not the raw collection.
 */
interface OptOutDoc {
  studentId: string;
  courseId: string;
  optedOutAt: Date;
}

export { OptOutRepository };
