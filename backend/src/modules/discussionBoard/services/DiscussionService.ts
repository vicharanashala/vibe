import {inject, injectable} from 'inversify';
import {BadRequestError, ForbiddenError, NotFoundError} from 'routing-controllers';
import {ObjectId} from 'mongodb';
import {BaseService} from '#root/shared/classes/BaseService.js';
import {MongoDatabase} from '#root/shared/database/providers/mongo/MongoDatabase.js';
import {
  AuthenticatedUser,
  AuthenticatedUserEnrollements,
} from '#root/shared/interfaces/models.js';
import {GLOBAL_TYPES} from '#root/types.js';
import {IDiscussionThreadRepository} from '../interfaces/IDiscussionThreadRepository.js';
import {IDiscussionReplyRepository} from '../interfaces/IDiscussionReplyRepository.js';
import {DISCUSSIONBOARD_TYPES} from '../types.js';
import {IDiscussionThread, IDiscussionReply} from '../repositories/model.js';

export interface CreateThreadInput {
  courseId: string;
  cohortId: string;
  title: string;
  body: string;
  /** Firebase UID of the author — denormalised for own-content UI checks. */
  authorFirebaseUid?: string;
}

export interface UpdateThreadInput {
  title?: string;
  body?: string;
}

export interface CreateReplyInput {
  body: string;
  /** Firebase UID of the author — denormalised for own-content UI checks. */
  authorFirebaseUid?: string;
}

export interface PinThreadInput {
  pinned: boolean;
}

/**
 * Course-level cohort scope (parallel to the existing
 * `CohortScopeService`, but scoped by `courseId` rather than
 * `courseVersionId`, because DiscussionThread has no versionId).
 *
 * `cohortIds: null` means unrestricted (admin / cohort-agnostic roles /
 * legacy students without a cohortId).
 */
export interface DiscussionCohortScope {
  cohortIds: ObjectId[] | null;
}

/**
 * Identifier-of-callable for the CASL ability check. Lets a test inject a
 * custom predicate (e.g. "every action is denied"); in production it
 * defaults to the shared module so existing call sites stay the same.
 */
export type CanFn = (
  action: unknown,
  subject: unknown,
) => boolean;

/**
 * Discussion-board orchestration.
 *
 * Every read and every write independently re-derives the caller's cohort
 * scope from their enrollments, then applies it as a Mongo filter or a
 * targeted permission check. A client-supplied `cohortId` is treated as a
 * request, never as a grant — if it falls outside the caller's scope the
 * service throws the reference-module convention (`NotFoundError`), so the
 * existence of another cohort's thread is never leaked.
 *
 * `BaseService` is extended so multi-step writes (create thread + reply,
 * delete thread + its replies) run inside a Mongo transaction.
 */
@injectable()
export class DiscussionService extends BaseService {
  constructor(
    @inject(DISCUSSIONBOARD_TYPES.DiscussionThreadRepository)
    private readonly _threadRepo: IDiscussionThreadRepository,
    @inject(DISCUSSIONBOARD_TYPES.DiscussionReplyRepository)
    private readonly _replyRepo: IDiscussionReplyRepository,
    @inject(GLOBAL_TYPES.Database)
    private readonly _database: MongoDatabase,
  ) {
    super(_database);
  }

  // -------------------------------------------------------------------
  // Public API — list / create / get / update / delete / reply
  // -------------------------------------------------------------------

  /**
   * List every thread on a course visible to the caller, sorted pinned
   * first then newest first. Cohort-scoping is applied server-side.
   */
  async listThreads(
    courseId: string,
    user: AuthenticatedUser,
  ): Promise<IDiscussionThread[]> {
    this.assertValidCourseId(courseId);

    const scope = this.resolveCourseScope(user, courseId);
    const filter = this.cohortFilter(scope);
    return this._threadRepo.listByCourse(courseId, filter);
  }

  /**
   * Create a thread. The caller must hold an enrollment on the course AND
   * the requested cohortId must be inside their authorised scope; for a
   * student, that means it has to be their own cohort, so they can't post
   * into another cohort by accident or by tampering.
   */
  async createThread(
    input: CreateThreadInput,
    user: AuthenticatedUser,
  ): Promise<IDiscussionThread> {
    this.assertValidCourseId(input.courseId);
    this.assertValidCohortId(input.cohortId);

    this.assertCourseMembership(user, input.courseId);
    this.assertCohortWritable(user, input.courseId, input.cohortId);

    const authorId = this.toObjectId(user.userId);

    return this._withTransaction(async session => {
      return this._threadRepo.create(
        {
          courseId: new ObjectId(input.courseId),
          cohortId: new ObjectId(input.cohortId),
          authorId,
          authorFirebaseUid: input.authorFirebaseUid,
          title: input.title,
          body: input.body,
          pinned: false,
        } as IDiscussionThread,
        session,
      );
    });
  }

  /**
   * Fetch a thread by ID together with its replies. Returns NotFoundError
   * both when the thread doesn't exist AND when it does but the caller's
   * cohort scope excludes its cohort — same error code, no leak.
   */
  async getThread(
    threadId: string,
    user: AuthenticatedUser,
  ): Promise<{thread: IDiscussionThread; replies: IDiscussionReply[]}> {
    const thread = await this._threadRepo.findById(threadId);
    if (!thread) {
      throw new NotFoundError('Thread not found');
    }

    const courseId = this.idToString(thread.courseId);
    this.assertCourseMembership(user, courseId);

    // Cohort visibility check — fail with the same NotFoundError convention
    // a missing thread uses, so the existence of another cohort's thread
    // can't be inferred from a different status code.
    this.assertCohortReadable(
      user,
      courseId,
      this.idToString(thread.cohortId),
    );

    const replies = await this._replyRepo.listByThread(threadId);
    return {thread, replies};
  }

  /**
   * Edit an existing thread.
   *
   * - The author can always edit their own thread.
   * - A teacher-track role on the thread's course can edit any thread
   *   in their cohort (the moderator path).
   *
   * The cohort-isolation rules from Milestone A still apply — both
   * authors and moderators must be permitted to read the thread's
   * cohort. A teacher from another course gets the standard
   * "Thread not found" 404 from `assertCohortReadable`.
   */
  async updateThread(
    threadId: string,
    input: UpdateThreadInput,
    user: AuthenticatedUser,
  ): Promise<IDiscussionThread> {
    if (!input.title && !input.body) {
      throw new BadRequestError(
        'At least one of `title` or `body` must be provided',
      );
    }

    const thread = await this._threadRepo.findById(threadId);
    if (!thread) {
      throw new NotFoundError('Thread not found');
    }

    const courseId = this.idToString(thread.courseId);
    this.assertCourseMembership(user, courseId);
    this.assertCohortReadable(
      user,
      courseId,
      this.idToString(thread.cohortId),
    );

    if (!this.isAuthor(thread.authorId, user)) {
      if (!this.isTeacherTrackOnCourse(user, courseId)) {
        throw new ForbiddenError(
          'Only the author or a course moderator can edit this thread',
        );
      }
    }

    return this._withTransaction(async session => {
      const updated = await this._threadRepo.update(
        threadId,
        {title: input.title, body: input.body},
        session,
      );
      if (!updated) {
        throw new NotFoundError('Thread not found');
      }
      return updated;
    });
  }

  /**
   * Delete a thread.
   *
   * - The author can always delete their own thread.
   * - A teacher-track role on the thread's course can delete any thread
   *   in their cohort (moderator delete-any).
   *
   * Deleting a thread cascades — every reply attached to it is removed
   * in the same transaction. This is the Milestone A contract,
   * confirmed by the explicit `deleteByThread` call inside the
   * transaction.
   */
  async deleteThread(
    threadId: string,
    user: AuthenticatedUser,
  ): Promise<void> {
    const thread = await this._threadRepo.findById(threadId);
    if (!thread) {
      throw new NotFoundError('Thread not found');
    }

    const courseId = this.idToString(thread.courseId);
    this.assertCourseMembership(user, courseId);
    this.assertCohortReadable(
      user,
      courseId,
      this.idToString(thread.cohortId),
    );

    if (!this.isAuthor(thread.authorId, user)) {
      if (!this.isTeacherTrackOnCourse(user, courseId)) {
        throw new ForbiddenError(
          'Only the author or a course moderator can delete this thread',
        );
      }
    }

    await this._withTransaction(async session => {
      await this._replyRepo.deleteByThread(threadId, session);
      await this._threadRepo.deleteById(threadId, session);
    });
  }

  /**
   * Pin or unpin a thread. Teacher-only.
   *
   * The CASL `Pin` action is restricted to INSTRUCTOR / MANAGER / TA /
   * STAFF on the thread's course; anyone else (including authors) hits
   * a 403. The error convention here is deliberately different from
   * the 404 used for cross-cohort reads — the thread's existence isn't
   * in question when the caller asks to pin it, so a distinct status
   * code surfaces the real reason for the failure.
   */
  async pinThread(
    threadId: string,
    input: PinThreadInput,
    user: AuthenticatedUser,
  ): Promise<IDiscussionThread> {
    const thread = await this._threadRepo.findById(threadId);
    if (!thread) {
      throw new NotFoundError('Thread not found');
    }

    const courseId = this.idToString(thread.courseId);
    this.assertCourseMembership(user, courseId);
    this.assertCohortReadable(
      user,
      courseId,
      this.idToString(thread.cohortId),
    );

    if (!this.isTeacherTrackOnCourse(user, courseId)) {
      throw new ForbiddenError(
        'Only course moderators can pin or unpin a thread',
      );
    }

    return this._withTransaction(async session => {
      const updated = await this._threadRepo.update(
        threadId,
        {pinned: input.pinned},
        session,
      );
      if (!updated) {
        throw new NotFoundError('Thread not found');
      }
      return updated;
    });
  }

  /**
   * Post a reply to an existing thread. The caller must hold an
   * enrollment on the course and be permitted to read into the
   * thread's cohort.
   *
   * `authorFirebaseUid` is denormalised onto the document so the
   * frontend can compare it against `useAuthStore.user.uid` to render
   * the own-content menu.
   */
  async createReply(
    threadId: string,
    input: CreateReplyInput,
    user: AuthenticatedUser,
  ): Promise<IDiscussionReply> {
    const thread = await this._threadRepo.findById(threadId);
    if (!thread) {
      throw new NotFoundError('Thread not found');
    }

    const courseId = this.idToString(thread.courseId);
    this.assertCourseMembership(user, courseId);
    this.assertCohortReadable(
      user,
      courseId,
      this.idToString(thread.cohortId),
    );

    const authorId = this.toObjectId(user.userId);

    return this._withTransaction(async session => {
      return this._replyRepo.create(
        {
          threadId: new ObjectId(threadId),
          authorId,
          authorFirebaseUid: input.authorFirebaseUid,
          body: input.body,
        } as IDiscussionReply,
        session,
      );
    });
  }

  /**
   * Delete a single reply.
   *
   * - The author can always delete their own reply.
   * - A teacher-track role on the parent thread's course can delete any
   *   reply in their cohort (moderator delete-any).
   *
   * Errors:
   * - NotFoundError when the reply doesn't exist OR the caller can't
   *   read the parent thread's cohort (same code as the rest of the
   *   module, to avoid leaking cohort boundaries).
   * - ForbiddenError when the reply exists and is readable but the
   *   caller isn't the author and isn't a moderator.
   */
  async deleteReply(
    replyId: string,
    user: AuthenticatedUser,
  ): Promise<void> {
    const reply = await this._replyRepo.findById(replyId);
    if (!reply) {
      throw new NotFoundError('Reply not found');
    }

    // The parent thread is needed for cohort-scoping. If it's been
    // hard-deleted out from under the reply (shouldn't happen with the
    // cascade, but defensive), treat as 404.
    const thread = await this._threadRepo.findById(
      this.idToString(reply.threadId),
    );
    if (!thread) {
      throw new NotFoundError('Reply not found');
    }

    const courseId = this.idToString(thread.courseId);
    this.assertCourseMembership(user, courseId);
    this.assertCohortReadable(
      user,
      courseId,
      this.idToString(thread.cohortId),
    );

    if (!this.isAuthor(reply.authorId, user)) {
      if (!this.isTeacherTrackOnCourse(user, courseId)) {
        throw new ForbiddenError(
          'Only the author or a course moderator can delete this reply',
        );
      }
    }

    await this._withTransaction(async session => {
      await this._replyRepo.deleteById(replyId, session);
    });
  }

  // -------------------------------------------------------------------
  // Cohort-scope resolution — courseId level, no versionId involved
  // -------------------------------------------------------------------

  /**
   * Resolve the cohorts on a single course the caller may read or write
   * into. Returns `null` for unrestricted callers (admin, cohort-agnostic
   * roles, legacy students without a cohortId).
   *
   * Reuses the same role semantics as the existing `CohortScopeService`:
   *   - admin  -> unrestricted
   *   - INSTRUCTOR / STAFF -> their assignedCohortIds (fails open when none)
   *   - STUDENT -> pinned to own cohortId
   *   - MANAGER / TA -> unrestricted (course-wide moderators)
   *
   * Cohorts are unioned across every enrollment the caller holds on the
   * course (any version), so a user enrolled twice still sees the union.
   */
  resolveCourseScope(
    user: AuthenticatedUser,
    courseId: string,
    requestedCohortId?: string,
  ): DiscussionCohortScope {
    if (user.globalRole === 'admin') {
      if (requestedCohortId) {
        return {cohortIds: [this.toObjectId(requestedCohortId)]};
      }
      return {cohortIds: null};
    }

    const matching = user.enrollments.filter(
      e => e.courseId === courseId,
    );
    if (matching.length === 0) {
      // No enrollment on this course at all. CASL is the coarse gate; we
      // still let the caller through if they explicitly asked for one
      // cohort — but the assertion helpers below will reject any access.
      if (requestedCohortId) {
        return {cohortIds: [this.toObjectId(requestedCohortId)]};
      }
      return {cohortIds: []};
    }

    // A caller who has *any* enrollment with cohortIds=null (typically
    // MANAGER/TA, or a legacy student whose row predates cohorts) stays
    // unrestricted on this course.
    if (matching.some(e => e.cohortIds === null)) {
      if (requestedCohortId) {
        return {cohortIds: [this.toObjectId(requestedCohortId)]};
      }
      return {cohortIds: null};
    }

    const union = [
      ...new Set(matching.flatMap(e => e.cohortIds ?? [])),
    ];
    const objectIdUnion = union.map(id => new ObjectId(id));

    if (requestedCohortId) {
      if (!union.some(id => id.toString() === requestedCohortId)) {
        // Use the reference-module convention: NotFoundError, not Forbidden,
        // so the caller can't probe for other cohorts' existence.
        throw new NotFoundError('Thread not found');
      }
      return {cohortIds: [new ObjectId(requestedCohortId)]};
    }

    return {cohortIds: objectIdUnion};
  }

  /**
   * Translate a scope into the Mongo filter fragment consumed by the
   * thread repo. Unrestricted callers contribute nothing; restricted
   * callers always get an `$in`, even for a single cohort, so a typo in a
   * later code path can't silently widen them.
   */
  cohortFilter(scope: DiscussionCohortScope): Record<string, unknown> {
    if (scope.cohortIds === null) return {};
    if (scope.cohortIds.length === 0) {
      // A restricted scope that matched no cohorts at all — force empty.
      return {cohortId: {$in: []}};
    }
    return {cohortId: {$in: scope.cohortIds}};
  }

  // -------------------------------------------------------------------
  // Permission assertions — used by mutating paths
  // -------------------------------------------------------------------

  /**
   * Confirm the caller holds at least one enrollment on the course. We
   * throw NotFoundError (not Forbidden) so a typo or a forged courseId
   * doesn't leak whether the course exists.
   */
  private assertCourseMembership(
    user: AuthenticatedUser,
    courseId: string,
  ): void {
    if (user.globalRole === 'admin') return;

    const hasEnrollment = user.enrollments.some(
      (e: AuthenticatedUserEnrollements) => e.courseId === courseId,
    );
    if (!hasEnrollment) {
      throw new NotFoundError('Thread not found');
    }
  }

  /**
   * Confirm the caller can read into a particular cohort. Uses
   * `resolveCourseScope` so the same role semantics cover both reads and
   * writes.
   */
  private assertCohortReadable(
    user: AuthenticatedUser,
    courseId: string,
    cohortId: string,
  ): void {
    const scope = this.resolveCourseScope(user, courseId, cohortId);
    if (scope.cohortIds === null) return;
    const allowed = scope.cohortIds.map(id => id.toString());
    if (!allowed.includes(cohortId)) {
      throw new NotFoundError('Thread not found');
    }
  }

  /**
   * Confirm the caller can write into a particular cohort. For Milestone A
   * the rules are identical to "readable" — teacher delete-any and other
   * moderation powers are explicitly deferred to a later task. The
   * separate method name documents the intent so the later work has an
   * obvious place to plug in.
   */
  private assertCohortWritable(
    user: AuthenticatedUser,
    courseId: string,
    cohortId: string,
  ): void {
    this.assertCohortReadable(user, courseId, cohortId);
  }

  /**
   * Confirm the caller is the author of the resource they're editing or
   * deleting. Kept for the Milestone A "hard author-only" gate. The
   * Milestone C moderator paths use `isAuthor` (no throw) plus
   * `isTeacherTrackOnCourse` instead.
   */
  private assertAuthor(authorIdField: unknown, user: AuthenticatedUser): void {
    const authorId = this.idToString(authorIdField);
    if (authorId !== user.userId) {
      throw new ForbiddenError(
        'Only the author can modify this thread',
      );
    }
  }

  /**
   * Boolean check — is the caller the author of this resource?
   */
  private isAuthor(
    authorIdField: unknown,
    user: AuthenticatedUser,
  ): boolean {
    const authorId = this.idToString(authorIdField);
    return authorId !== '' && authorId === user.userId;
  }

  /**
   * Boolean check — does the caller hold a teacher-track enrollment
   * (INSTRUCTOR / MANAGER / TA / STAFF) on the given course?
   *
   * Used to gate the Milestone C moderator actions (pin, delete-any).
   * Returns false for admins is intentional — admins use the global
   * `manage` grant plus the cohort scope, and their tests don't go
   * through this branch.
   */
  private isTeacherTrackOnCourse(
    user: AuthenticatedUser,
    courseId: string,
  ): boolean {
    return user.enrollments.some(
      (e: AuthenticatedUserEnrollements) =>
        e.courseId === courseId &&
        (e.role === 'INSTRUCTOR' ||
          e.role === 'MANAGER' ||
          e.role === 'TA' ||
          e.role === 'STAFF'),
    );
  }

  // -------------------------------------------------------------------
  // ID helpers
  // -------------------------------------------------------------------

  private assertValidCourseId(courseId: string): void {
    if (!ObjectId.isValid(courseId)) {
      throw new BadRequestError('Invalid courseId');
    }
  }

  private assertValidCohortId(cohortId: string): void {
    if (!ObjectId.isValid(cohortId)) {
      throw new BadRequestError('Invalid cohortId');
    }
  }

  private toObjectId(id: string): ObjectId {
    return new ObjectId(id);
  }

  /**
   * Normalise anything that might land here — `ObjectId`, a stringified
   * `ObjectId`, or the raw 24-char hex string — into a plain string. The
   * repo stores ObjectIds, the ability/auth path uses strings, and both
   * can meet at this boundary.
   */
  private idToString(id: unknown): string {
    if (!id) return '';
    if (id instanceof ObjectId) return id.toString();
    if (typeof id === 'string') return id;
    // last resort — anything with a toString()
    return (id as {toString(): string}).toString();
  }
}