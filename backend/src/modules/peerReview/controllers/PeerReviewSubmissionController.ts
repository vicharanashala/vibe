import {
  JsonController,
  Post,
  Get,
  Body,
  QueryParam,
  HttpCode,
  Authorized,
  CurrentUser,
  Param,
  Req,
} from 'routing-controllers';
import { injectable, inject } from 'inversify';
import { ObjectId } from 'mongodb';
import { BadRequestError } from 'routing-controllers';
import { PEERREVIEW_TYPES } from '../types.js';
import { PeerReviewSubmissionService } from '../services/PeerReviewSubmissionService.js';
import { PeerReviewAssessmentRepository } from '../repositories/providers/mongodb/PeerReviewAssessmentRepository.js';
import { PeerReviewUrlAccessibilityService } from '../services/PeerReviewUrlAccessibilityService.js';
import { SubmitPeerReviewBody } from '../classes/validators/PeerReviewSubmissionValidators.js';
import { IUser } from '#shared/interfaces/models.js';
import { setAuditTrail } from '#root/utils/setAuditTrail.js';
import { AuditCategory, AuditAction } from '#root/modules/auditTrails/interfaces/IAuditTrails.js';

/**
 * Student-side HTTP endpoints for submitting to a peer-review assessment.
 *
 * Phase 3 routes:
 *   POST /courses/:courseId/versions/:versionId/items/:itemId/submit
 *   GET  /students/me/submissions?assessmentId=...
 *
 * Auth: @Authorized() (any logged-in user). Phase 5 will tighten with
 * a CASL-based cohort check.
 */
@injectable()
@JsonController()
export class PeerReviewSubmissionController {
  constructor(
    @inject(PEERREVIEW_TYPES.PeerReviewSubmissionService)
    private readonly service: PeerReviewSubmissionService,
    @inject(PEERREVIEW_TYPES.PeerReviewAssessmentRepo)
    private readonly assessmentRepo: PeerReviewAssessmentRepository,
    @inject(PEERREVIEW_TYPES.PeerReviewUrlAccessibilityChecker)
    private readonly accessibilityChecker: PeerReviewUrlAccessibilityService,
  ) {}

  @Post('/courses/:courseId/versions/:versionId/items/:itemId/submit')
  @HttpCode(201)
  @Authorized()
  async submit(
    @Req() req: any,
    @CurrentUser({ required: true }) user: IUser,
    @Param('courseId') _courseId: string,
    @Param('versionId') _versionId: string,
    @Param('itemId') itemId: string,
    @Body() body: SubmitPeerReviewBody,
  ): Promise<{ submissionId: string }> {
    // Look up the assessmentId from the item record. We don't trust
    // the client to pass the assessmentId directly because that's a
    // dev-friendly leak — the routing is by Item, which is the
    // course-tree handle.
    const assessment = await this.assessmentRepo.findByItemId(itemId);
    if (!assessment || assessment.isDeleted) {
      throw new BadRequestError(
        'No peer-review assessment is attached to this item.',
      );
    }
    const result = await this.service.submit(user, assessment._id as any as string, body);
    setAuditTrail(req, {
      category: AuditCategory.PEER_REVIEW,
      action: AuditAction.PEER_REVIEW_SUBMISSION_CREATE,
      actor: {
        id: new ObjectId(user._id!.toString()),
        name: `${user.firstName} ${user.lastName}`,
        email: user.email,
        role: user.roles,
      },
      context: {
        courseId: (assessment as any).courseId,
        courseVersionId: (assessment as any).courseVersionId,
        peerReviewAssessmentId: (assessment._id as any).toString() as any,
      },
    });
    return result;
  }

  @Get('/students/me/submissions')
  @HttpCode(200)
  @Authorized()
  async getMine(
    @CurrentUser({ required: true }) user: IUser,
    @QueryParam('assessmentId') assessmentId?: string,
  ): Promise<any> {
    if (!assessmentId) {
      throw new BadRequestError('assessmentId query param is required.');
    }
    return this.service.getMine(user, assessmentId);
  }

  /**
   * GET /students/me/submissions/summary?courseId=...&courseVersionId=...&cohortId=...
   *
   * Returns a FLAT list of (assessmentId, submitted) pairs for every
   * peer-review assessment in the given course/version/cohort. No
   * nested arrays, no links field — just primitive fields so
   * openapi-fetch's querySerializer can deserialize without crashing.
   *
   * Used by the sidebar to show "Submitted" / "Not submitted" badges
   * on every peer-review item in one round-trip.
   */
  @Get('/students/me/submissions/summary')
  @HttpCode(200)
  @Authorized()
  async getMySubmissionSummary(
    @CurrentUser({ required: true }) user: IUser,
    @QueryParam('courseId') courseId?: string,
    @QueryParam('courseVersionId') courseVersionId?: string,
    @QueryParam('cohortId') cohortId?: string,
  ): Promise<Array<{ assessmentId: string; submitted: boolean; submittedAt?: string }>> {
    if (!courseId || !courseVersionId) {
      throw new BadRequestError('courseId and courseVersionId are required.');
    }
    return this.service.getSubmissionSummary(
      user,
      courseId,
      courseVersionId,
      cohortId,
    );
  }

  /**
   * GET /peer-review-links/check?url=...
   *
   * Audit-improvement tier-2.a: live accessibility badge. Lets the
   * frontend check a URL as the user types/pastes (debounced 500ms)
   * without committing the submission. The same PeerReviewUrlAccessibilityService
   * 60s in-memory cache means rapid checks within a session are cheap.
   *
   * Auth: any logged-in user. Returning the result is not a leak
   * since the URL is something the requester would have had access
   * to anyway (they typed it).
   */
  @Get('/peer-review-links/check')
  @HttpCode(200)
  @Authorized()
  async checkLink(
    @QueryParam('url') url?: string,
  ): Promise<{ accessible: boolean; reason?: string }> {
    if (!url || url.trim().length === 0) {
      return { accessible: false, reason: 'empty_url' };
    }
    return this.accessibilityChecker.check(url.trim());
  }
}
