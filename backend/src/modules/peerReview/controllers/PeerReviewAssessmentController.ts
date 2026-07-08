import { JsonController, Post, Patch, Get, Param, Body, HttpCode, Authorized, CurrentUser, Req } from 'routing-controllers';
import { injectable, inject } from 'inversify';
import { ObjectId } from 'mongodb';
import { ForbiddenError, InternalServerError } from 'routing-controllers';
import { PEERREVIEW_TYPES } from '../types.js';
import { PeerReviewAssessmentService } from '../services/PeerReviewAssessmentService.js';
import {
  CreatePeerReviewAssessmentBody,
  UpdatePeerReviewAssessmentBody,
} from '../classes/validators/PeerReviewValidators.js';
import { IUser } from '#shared/interfaces/models.js';
import {
  AuditCategory,
  AuditAction,
  OutComeStatus,
} from '#root/modules/auditTrails/interfaces/IAuditTrails.js';
import { setAuditTrail } from '#root/utils/setAuditTrail.js';

/**
 * Teacher-side HTTP endpoints for the peer-review assessment item type.
 *
 * Phase 2 routes:
 *   POST  /peer-review-assessments                            (create)
 *   PATCH /peer-review-assessments/:id                        (edit)
 *   GET   /peer-review-assessments/:id                        (read)
 *   POST  /peer-review-assessments/:id/close                  (manual close)
 *
 * Authorization:
 *   - @Authorized(['INSTRUCTOR', 'MANAGER']) for create/edit/close
 *   - @Authorized() (any logged-in user) for read; the service's
 *     get() returns the assessment and the controller additionally
 *     strips teacher-only fields for non-teachers via a future
 *     Phase-3 controller method (redaction layer).
 *
 * For Phase 2 we keep the read open to any authenticated user; the
 * assessment only contains rubric titles (not submissions) so it is
 * safe to leak to enrolled students.
 */
@injectable()
@JsonController('/peer-review-assessments')
export class PeerReviewAssessmentController {
  constructor(
    @inject(PEERREVIEW_TYPES.PeerReviewAssessmentService)
    private readonly service: PeerReviewAssessmentService,
  ) {}

  @Post('/')
  @HttpCode(201)
  @Authorized(['INSTRUCTOR', 'MANAGER'])
  async create(
    @Req() req: any,
    @CurrentUser({ required: true }) user: IUser,
    @Body() body: CreatePeerReviewAssessmentBody,
  ): Promise<{ assessmentId: string; itemId: string }> {
    const result = await this.service.create(user, body);
    setAuditTrail(req, {
      category: AuditCategory.PEER_REVIEW,
      action: AuditAction.PEER_REVIEW_ASSESSMENT_CREATE,
      actor: {
        id: new ObjectId(user._id!.toString()),
        name: `${user.firstName} ${user.lastName}`,
        email: user.email,
        role: user.roles,
      },
      context: {
        courseId: body.courseId as any,
        courseVersionId: body.courseVersionId as any,
        peerReviewAssessmentId: result.assessmentId as any,
      },
    });
    return result;
  }

  @Patch('/:id')
  @HttpCode(200)
  @Authorized(['INSTRUCTOR', 'MANAGER'])
  async edit(
    @Req() req: any,
    @CurrentUser({ required: true }) user: IUser,
    @Param('id') id: string,
    @Body() body: UpdatePeerReviewAssessmentBody,
  ): Promise<{ ok: true }> {
    await this.service.edit(user, id, body);
    setAuditTrail(req, {
      category: AuditCategory.PEER_REVIEW,
      action: AuditAction.PEER_REVIEW_ASSESSMENT_UPDATE,
      actor: {
        id: new ObjectId(user._id!.toString()),
        name: `${user.firstName} ${user.lastName}`,
        email: user.email,
        role: user.roles,
      },
      context: { peerReviewAssessmentId: id as any },
    });
    return { ok: true };
  }

  @Get('/:id')
  @HttpCode(200)
  @Authorized()
  async get(
    @Param('id') id: string,
    // @CurrentUser() user: IUser, // reserved for Phase 3 redactor
  ): Promise<any> {
    const a = await this.service.get(id);
    // Strip teacher-only audit fields for non-admin viewers; Phase 3
    // will replace this with a CASL-aware redactor. For now we always
    // return the assessment — students reading this need it for the
    // submission form.
    return a;
  }

  @Post('/:id/close')
  @HttpCode(200)
  @Authorized(['INSTRUCTOR', 'MANAGER'])
  async close(
    @Req() req: any,
    @CurrentUser({ required: true }) user: IUser,
    @Param('id') id: string,
  ): Promise<{ ok: true }> {
    await this.service.close(user, id);
    setAuditTrail(req, {
      category: AuditCategory.PEER_REVIEW,
      action: AuditAction.PEER_REVIEW_ASSESSMENT_CLOSED,
      actor: {
        id: new ObjectId(user._id!.toString()),
        name: `${user.firstName} ${user.lastName}`,
        email: user.email,
        role: user.roles,
      },
      context: { peerReviewAssessmentId: id as any },
    });
    return { ok: true };
  }
}

/**
 * Audit-trail wiring (Phase 7 audit-improvement tier-2.b).
 *
 * The 3 endpoints above (create, edit, close) emit InstructorAuditTrail
 * entries via setAuditTrail(). The actual write to the audit_trails
 * collection happens later in the request lifecycle (the existing
 * per-request middleware handles the persist). This change closes the
 * "audit-log was a TODO" gap from Phase 2 commit 1.
 *
 * AuditCategory / AuditAction enum values were reserved in Phase 1
 * commit 4; this is the first consumer.
 */
export {};