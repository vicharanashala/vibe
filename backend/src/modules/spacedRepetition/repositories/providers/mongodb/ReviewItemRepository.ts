import { IReviewItem } from '#spacedRepetition/interfaces/IReviewItem.js';
import { GLOBAL_TYPES } from '#root/types.js';
import { MongoDatabase } from '#shared/database/providers/mongo/MongoDatabase.js';
import { injectable, inject } from 'inversify';
import { Collection, ClientSession, ObjectId, Filter } from 'mongodb';

@injectable()
class ReviewItemRepository {
  private reviewItemCollection: Collection<IReviewItem>;

  constructor(
    @inject(GLOBAL_TYPES.Database)
    private db: MongoDatabase,
  ) {}

  private async init() {
    this.reviewItemCollection =
      await this.db.getCollection<IReviewItem>('review_items');
  }

  /**
   * Insert a single ReviewItem.
   * Called when seeding a schedule for one question on course completion.
   */
  async create(
    item: Omit<IReviewItem, '_id'>,
    session?: ClientSession,
  ): Promise<IReviewItem> {
    await this.init();
    const result = await this.reviewItemCollection.insertOne(
      item as IReviewItem,
      { session },
    );
    return { ...item, _id: result.insertedId };
  }

  /**
   * Bulk-insert multiple ReviewItems in one operation.
   * Called when seeding the full schedule on course completion —
   * one item per question in the course question bank.
   */
  async createMany(
    items: Omit<IReviewItem, '_id'>[],
    session?: ClientSession,
  ): Promise<number> {
    await this.init();
    const result = await this.reviewItemCollection.insertMany(
      items as IReviewItem[],
      { session },
    );
    return result.insertedCount;
  }

  /**
   * Find all items whose next_review_at is on or before `now`.
   * Called by the cron job to determine which students need a notification.
   *
   * Optional `limit` caps the result set. The cron currently passes
   * no cap because it needs every due item across all students to
   * group notifications. The `limit` is a defensive foot-gun for
   * future callers (e.g. a student-facing "what's due" widget) to
   * avoid pulling the entire schedule per request (audit B3).
   */
  async findDueItems(
    now: Date,
    session?: ClientSession,
    limit?: number,
    options?: { excludeOptedOut?: boolean },
  ): Promise<IReviewItem[]> {
    await this.init();
    const filter: Filter<IReviewItem> = { next_review_at: { $lte: now } };
    if (options?.excludeOptedOut) {
      // N2: push the opted-out filter to the database so the cron
      // doesn't pull items it will immediately discard. Uses $ne:true
      // (not `==:false`) so docs that pre-date the field default to
      // "not opted out" — matches the existing Knob 5 codebase pattern.
      filter.notification_opt_out = { $ne: true };
    }
    const cursor = this.reviewItemCollection.find(filter, { session });
    if (typeof limit === 'number' && limit > 0) {
      cursor.limit(limit);
    }
    return cursor.toArray();
  }

  /**
   * Find all ReviewItems for a given student across all courses.
   * Called by the dashboard endpoint to show upcoming review schedule.
   */
  async findByStudent(
    studentId: string,
    session?: ClientSession,
  ): Promise<IReviewItem[]> {
    await this.init();
    return this.reviewItemCollection
      .find({ student_id: studentId }, { session })
      .toArray();
  }

  /**
   * Find all ReviewItems for a given student within a specific course.
   * Called by the per-course retention view on the student dashboard.
   */
  async findByStudentAndCourse(
    studentId: string,
    courseId: string,
    session?: ClientSession,
  ): Promise<IReviewItem[]> {
    await this.init();
    return this.reviewItemCollection
      .find({ student_id: studentId, course_id: courseId }, { session })
      .toArray();
  }

  /**
   * Find the specific ReviewItem for a (student, question) pair.
   * Called by the service before running the SM-2 update after a review response.
   */
  async findByStudentAndQuestion(
    studentId: string,
    questionId: string,
    session?: ClientSession,
  ): Promise<IReviewItem | null> {
    await this.init();
    return this.reviewItemCollection.findOne(
      { student_id: studentId, question_id: questionId },
      { session },
    );
  }

  /**
   * Persist updated SM-2 state and scheduling fields after a review response.
   * Only the fields that change after a review are updated — _id, student_id,
   * course_id, and question_id are never mutated.
   */
  async update(
    id: string,
    updates: Partial<
      Pick<
        IReviewItem,
        | 'n'
        | 'EF'
        | 'interval_days'
        | 'next_review_at'
        | 'last_reviewed_at'
        | 'remediation_hint'
      >
    >,
    session?: ClientSession,
  ): Promise<IReviewItem | null> {
    await this.init();
    return this.reviewItemCollection.findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: updates },
      { returnDocument: 'after', session },
    );
  }

  /**
   * Flip the notification_opt_out flag for every ReviewItem belonging to
   * a student in a given course. Called when the student toggles
   * notification preferences for that course.
   */
  async updateOptOut(
    studentId: string,
    courseId: string,
    optOut: boolean,
    session?: ClientSession,
  ): Promise<number> {
    await this.init();
    const result = await this.reviewItemCollection.updateMany(
      { student_id: studentId, course_id: courseId },
      { $set: { notification_opt_out: optOut } },
      { session },
    );
    return result.modifiedCount;
  }

  /**
   * Bulk flip the notification_opt_out flag for an array of students within
   * a given course. Called by the teacher dashboard for cohort-level
   * management.
   *
   * Returns both the raw item count AND the distinct-student count so the
   * service layer can report an honest "X students / Y review items"
   * result. Previously this returned just `modifiedCount`, which was
   * being mislabelled as a student count in the teacher UI (Bug 3,
   * 2026-08-01) because each student has many review items per course.
   *
   * Two round-trips: a `distinct('student_id', ...)` against the
   * existing `(student_id, course_id)` compound index (cheap), then the
   * updateMany. The distinct happens BEFORE the update so the count
   * reflects the same set that was actually mutated.
   *
   * @returns `{ modifiedCount, distinctStudentsModified }`
   *   - `modifiedCount`: number of ReviewItem docs the `$set` actually
   *      changed (Mongo semantics: excludes no-op writes where the
   *      flag was already at the desired value).
   *   - `distinctStudentsModified`: number of UNIQUE `student_id`s
   *      whose items matched the (studentIds, courseId) filter.
   */
  async updateOptOutBulk(
    studentIds: string[],
    courseId: string,
    optOut: boolean,
    session?: ClientSession,
  ): Promise<{ modifiedCount: number; distinctStudentsModified: number }> {
    await this.init();
    const distinctIds = await this.reviewItemCollection.distinct(
      'student_id',
      { student_id: { $in: studentIds }, course_id: courseId },
      { session },
    );
    const result = await this.reviewItemCollection.updateMany(
      {
        student_id: { $in: studentIds },
        course_id: courseId,
      },
      { $set: { notification_opt_out: optOut } },
      { session },
    );
    return {
      modifiedCount: result.modifiedCount,
      distinctStudentsModified: distinctIds.length,
    };
  }

  /**
   * Bulk flip the exam_prep_mode flag for an array of students within
   * a given course.
   *
   * See `updateOptOutBulk` for the rationale on the dual-count return
   * shape (Bug 3, 2026-08-01 — item-count vs student-count).
   */
  async updateExamPrepBulk(
    studentIds: string[],
    courseId: string,
    enabled: boolean,
    session?: ClientSession,
  ): Promise<{ modifiedCount: number; distinctStudentsModified: number }> {
    await this.init();
    const distinctIds = await this.reviewItemCollection.distinct(
      'student_id',
      { student_id: { $in: studentIds }, course_id: courseId },
      { session },
    );
    const result = await this.reviewItemCollection.updateMany(
      {
        student_id: { $in: studentIds },
        course_id: courseId,
      },
      { $set: { exam_prep_mode: enabled } },
      { session },
    );
    return {
      modifiedCount: result.modifiedCount,
      distinctStudentsModified: distinctIds.length,
    };
  }

  /**
   * Bulk flip the `is_paused` flag for an array of students within a
   * given course (added 2026-08-04 — Day 2 teacher control hooks).
   *
   * Mirrors `updateExamPrepBulk` exactly so the two endpoints share the
   * same dual-count return shape (Bug 3, 2026-08-01). Paused items are
   * excluded from `findDueItems`, so this is the teacher-level kill
   * switch for a student's review queue.
   *
   * NOTE: when `paused === false`, this also flips items that were
   * previously paused by `updatePauseSingle` (per-card pause via the
   * per-card row in the teacher dashboard). Same flag, same predicate.
   */
  async updatePauseBulk(
    studentIds: string[],
    courseId: string,
    paused: boolean,
    session?: ClientSession,
  ): Promise<{ modifiedCount: number; distinctStudentsModified: number }> {
    await this.init();
    const distinctIds = await this.reviewItemCollection.distinct(
      'student_id',
      { student_id: { $in: studentIds }, course_id: courseId },
      { session },
    );
    const result = await this.reviewItemCollection.updateMany(
      {
        student_id: { $in: studentIds },
        course_id: courseId,
      },
      { $set: { is_paused: paused } },
      { session },
    );
    return {
      modifiedCount: result.modifiedCount,
      distinctStudentsModified: distinctIds.length,
    };
  }

  /**
   * Gets a list of unique student IDs who have active review items for a specific course.
   */
  async getDistinctStudentsForCourse(
    courseId: string,
    session?: ClientSession,
  ): Promise<string[]> {
    await this.init();
    const studentIds = await this.reviewItemCollection.distinct(
      'student_id',
      { course_id: courseId },
      { session }
    );
    return studentIds as string[];
  }

  /**
   * Day 2 (2026-08-04): backs `GET /api/spaced-repetition/courses`.
   * Returns the distinct course IDs that have at least one ReviewItem,
   * each paired with the count of distinct students who have a schedule
   * for that course. Used by the teacher dashboard course picker.
   *
   * Implementation: one `$group` aggregation that does both `distinct`
   * counts in a single round-trip — cheaper than 2N distinct queries
   * (one per course to count its students). The `_id` field is the
   * course id, with `studentCount` as the only projection.
   *
   * Courses with no ReviewItems are NOT included (this is intentional —
   * the teacher surface only cares about courses with active schedules).
   * If a course exists in `ICourse` but has no schedules, the UI
   * shows an empty-state message instead.
   *
   * Fail-open: returns [] on empty / error; the service layer logs
   * and returns the same empty shape so the controller can render
   * the empty-state without distinguishing "no data" from "error".
   */
  async getDistinctCoursesWithStudentCount(
    session?: ClientSession,
  ): Promise<Array<{ courseId: string; studentCount: number }>> {
    await this.init();
    const cursor = this.reviewItemCollection.aggregate(
      [
        {
          $group: {
            _id: '$course_id',
            studentIds: { $addToSet: '$student_id' },
          },
        },
        {
          $project: {
            _id: 0,
            courseId: '$_id',
            studentCount: { $size: '$studentIds' },
          },
        },
        { $sort: { courseId: 1 } },
      ],
      { session },
    );
    const results = await cursor.toArray();
    return results as Array<{ courseId: string; studentCount: number }>;
  }

}

export { ReviewItemRepository };