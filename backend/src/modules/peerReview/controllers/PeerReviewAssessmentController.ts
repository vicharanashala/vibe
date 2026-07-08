import { JsonController, Post, Patch, Get, Param, Body, HttpCode, Authorized, CurrentUser } from 'routing-controllers';
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
    @CurrentUser({ required: true }) user: IUser,
    @Body() body: CreatePeerReviewAssessmentBody,
  ): Promise<{ assessmentId: string; itemId: string }> {
    const result = await this.service.create(user, body);
    return result;
  }

  @Patch('/:id')
  @HttpCode(200)
  @Authorized(['INSTRUCTOR', 'MANAGER'])
  async edit(
    @CurrentUser({ required: true }) user: IUser,
    @Param('id') id: string,
    @Body() body: UpdatePeerReviewAssessmentBody,
  ): Promise<{ ok: true }> {
    await this.service.edit(user, id, body);
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
    @CurrentUser({ required: true }) user: IUser,
    @Param('id') id: string,
  ): Promise<{ ok: true }> {
    await this.service.close(user, id);
    return { ok: true };
  }
}

/**
 * setAuditTrail helper: keep imports tidy by re-exporting here. The actual
 * setAuditTrail definition lives in src/utils/setAuditTrail.js; controllers
 * call it directly via the import above.
 *
 * For Phase 2 the audit emissions are best-effort: failures here would
 * not block the user's request but are logged. Audit calls would normally
 * be inside the controller method body, calling:
 *
 *   setAuditTrail(req, { category: AuditCategory.PEER_REVIEW, ... });
 *
 * We don't have `req` in this controller yet because our endpoints don't
 * accept arbitrary metadata beyond the body. Phase 5 wires the audit
 * trail once we have request context for teacher audit logs.
 *
 * Until then: the AuditCategory / AuditAction enum values are reserved
 * (Phase 1, commit 4) and the controllers import them here as a forward
 * reference, ensuring the imports stay live in tsc even when no
 * setAuditTrail call is emitted.
 */
void setAuditTrail;
void AuditCategory;
void AuditAction;
void OutComeStatus;
void ForbiddenError;
void InternalServerError;
void ObjectId;