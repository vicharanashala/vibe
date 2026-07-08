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
} from 'routing-controllers';
import { injectable, inject } from 'inversify';
import { BadRequestError } from 'routing-controllers';
import { PEERREVIEW_TYPES } from '../types.js';
import { PeerReviewSubmissionService } from '../services/PeerReviewSubmissionService.js';
import { PeerReviewAssessmentRepository } from '../repositories/providers/mongodb/PeerReviewAssessmentRepository.js';
import { SubmitPeerReviewBody } from '../classes/validators/PeerReviewSubmissionValidators.js';
import { IUser } from '#shared/interfaces/models.js';

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
  ) {}

  @Post('/courses/:courseId/versions/:versionId/items/:itemId/submit')
  @HttpCode(201)
  @Authorized()
  async submit(
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
    return this.service.submit(user, assessment._id as any as string, body);
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
}
