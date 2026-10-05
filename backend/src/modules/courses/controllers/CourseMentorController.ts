import {injectable, inject} from 'inversify';
import {
  JsonController,
  Patch,
  Body,
  Params,
  ForbiddenError,
  NotFoundError,
  Authorized,
  HttpCode,
  UseInterceptor,
  Req,
  CurrentUser,
} from 'routing-controllers';
import {OpenAPI, ResponseSchema} from 'routing-controllers-openapi';
import {GLOBAL_TYPES} from '#root/types.js';
import {CourseRepository} from '#shared/database/providers/mongo/repositories/CourseRepository.js';
import {IUser} from '#root/shared/interfaces/models.js';
import {
  CourseIdParams,
  ManageMentorsBody,
  ManageMentorsResponse,
  ManageMentorsForbiddenResponse,
  ManageMentorsNotFoundResponse,
} from '../classes/validators/CourseValidators.js';
import {AuditTrailsHandler} from '#root/shared/middleware/auditTrails.js';
import {setAuditTrail} from '#root/utils/setAuditTrail.js';
import {
  AuditAction,
  AuditCategory,
  OutComeStatus,
} from '#root/modules/auditTrails/interfaces/IAuditTrails.js';
import {ObjectId} from 'mongodb';

/**
 * Admin-only endpoint to manage a course's mentor list.
 *
 * Background (Pillar 4 / Locked decision 4):
 * `course.mentorIds` is a separate list from `course.instructors`.
 * Teachers default-granted via the `_assertMentorOnCourse` helper's
 * `instructors ∪ mentorIds` check — but a non-instructor teacher
 * (mentor) must be explicitly listed here to access the motivation
 * system's mentor view. See PLAN_MOTIVATION_DECISION4_MENTORIDS.md.
 *
 * Endpoint contract:
 * - `PATCH /api/courses/:courseId/mentors`
 * - Body: `{ add: string[], remove: string[] }` — arrays of user IDs.
 *   Either or both may be missing/empty; an empty body is a no-op.
 * - Auth: `@Authorized(['admin'])` only. Other roles get 403.
 * - Idempotent: re-adding an existing mentor or re-removing a non-
 *   mentor is a no-op. The returned `mentorIds` array always reflects
 *   the post-update state of the course doc.
 * - Conflict resolution: if the same userId appears in BOTH `add` and
 *   `remove`, `remove` wins (the pipeline applies $addToSet before
 *   $pull, so the final state is "not present"). Documented in the
 *   plan doc.
 * - 404 when the course doesn't exist.
 *
 * This endpoint does NOT manage enrollment. `mentorIds` is decoupled
 * from the enrollment collection — admins may mentor a course they
 * don't teach. Future hardening may restrict `add` to enrolled
 * students + teachers; explicitly out of scope per the plan.
 */
@OpenAPI({
  tags: ['Courses'],
  description: 'Admin-only management of a course mentor list',
})
@injectable()
@JsonController('/courses')
export class CourseMentorController {
  constructor(
    @inject(GLOBAL_TYPES.CourseRepo)
    private readonly courseRepo: CourseRepository,
  ) {}

  /**
   * Apply `{add, remove}` to `course.mentorIds` and return the
   * updated list. The repo uses Mongo's native `$addToSet` + `$pull`
   * to stay atomic — no read-modify-write race window.
   *
   * The returned `mentorIds` array reflects the post-update state
   * (post `$addToSet` is idempotent, so duplicates collapse; `$pull`
   * only removes values that exist).
   */
  @OpenAPI({
    summary: 'Manage course mentor list (admin only)',
    description:
      'Add or remove user IDs from `course.mentorIds`. Either or both arrays may be empty. Idempotent: duplicates are collapsed; non-members cannot be removed.',
  })
  @Authorized(['admin'])
  @Patch('/:courseId/mentors', {transformResponse: true})
  @UseInterceptor(AuditTrailsHandler)
  @HttpCode(200)
  @ResponseSchema(ManageMentorsResponse, {
    description: 'Updated mentor list',
    statusCode: 200,
  })
  @ResponseSchema(ManageMentorsNotFoundResponse, {
    description: 'Course not found',
    statusCode: 404,
  })
  @ResponseSchema(ManageMentorsForbiddenResponse, {
    description: 'Not an admin',
    statusCode: 403,
  })
  async manageMentors(
    @Params() params: CourseIdParams,
    @Body() body: ManageMentorsBody,
    @CurrentUser() user: IUser,
    @Req() req: Request,
  ): Promise<ManageMentorsResponse> {
    const {courseId} = params;
    const add = body.add ?? [];
    const remove = body.remove ?? [];

    // Defense in depth: @Authorized(['admin']) is the primary gate,
    // but we re-check the role on the user doc in case the token's
    // role mapping is stale. Same role string convention as the SR
    // module (`'admin'` for admins, `'user'` for non-admins).
    const isAdmin = user.roles?.includes('admin') || user.roles === 'admin';
    if (!isAdmin) {
      throw new ForbiddenError(
        'Only admins can manage the course mentor list',
      );
    }

    // Verify the course exists first. Otherwise Mongo's updateOne
    // silently succeeds (matchedCount = 0) and we'd return an empty
    // array — confusing. Surfaces as 404 instead.
    const existing = await this.courseRepo.read(courseId);
    if (!existing) {
      throw new NotFoundError(
        `No course found with id ${courseId}`,
      );
    }

    // Apply `$addToSet` (deduplicates) and `$pull` (no-op on missing)
    // in one atomic update. See PLAN_MOTIVATION_DECISION4_MENTORIDS.md
    // for the conflict-resolution semantics.
    const updateResult = await this.courseRepo.updateMentors(
      courseId,
      add,
      remove,
    );

    // Read the resulting list fresh so the caller sees what actually
    // landed. Returns null when the course doc was deleted between
    // our pre-check and this fetch — defensive guard against the rare
    // admin race.
    const updatedMentorIds = await this.courseRepo.getMentorIds(courseId);
    if (updatedMentorIds === null) {
      throw new NotFoundError(
        `Course ${courseId} disappeared during mentor update`,
      );
    }

    setAuditTrail(req, {
      category: AuditCategory.COURSE,
      action: AuditAction.COURSE_UPDATE,
      actor: {
        id: ObjectId.createFromHexString(user._id?.toString() ?? ''),
        name: `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim(),
        email: user.email ?? '',
        role: user.roles ?? 'user',
      },
      context: {
        courseId: ObjectId.createFromHexString(courseId),
      },
      changes: {
        before: {mentorIds: existing.mentorIds ?? []},
        after: {mentorIds: updatedMentorIds},
      },
      outcome: {
        status: OutComeStatus.SUCCESS,
      },
    });

    return {
      courseId,
      mentorIds: updatedMentorIds,
      added: add,
      removed: remove,
      // `updateResult` is `UpdateResult | null`. Null means both add/remove
      // arrays were empty (the repo skipped the round trip). In that case
      // matchedCount=1 (we verified the course exists) and modifiedCount=0.
      matchedCount: updateResult?.matchedCount ?? 1,
      modifiedCount: updateResult?.modifiedCount ?? 0,
    };
  }
}
