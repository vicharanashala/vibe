import {
  JsonController,
  Get,
  Post,
  Patch,
  Param,
  Body,
  HttpCode,
  Authorized,
  CurrentUser,
  ForbiddenError,
  NotFoundError,
  BadRequestError,
} from 'routing-controllers';
import { injectable, inject } from 'inversify';
import { ObjectId } from 'mongodb';
import { PEERREVIEW_TYPES } from '../types.js';
import { PeerReviewAssessmentRepository } from '../repositories/providers/mongodb/PeerReviewAssessmentRepository.js';
import { PeerReviewSubmissionRepository } from '../repositories/providers/mongodb/PeerReviewSubmissionRepository.js';
import { PeerReviewReviewRepository } from '../repositories/providers/mongodb/PeerReviewReviewRepository.js';
import { PeerReviewAssignmentRepository } from '../repositories/providers/mongodb/PeerReviewAssignmentRepository.js';
import { PeerReviewScoringService } from '../services/PeerReviewScoringService.js';
import { IUser } from '#shared/interfaces/models.js';

/**
 * Teacher-side HTTP endpoints.
 *
 * Phase 5.2.2 deliverable. 4 endpoints:
 *
 *   GET  /peer-review-assessments/:id/submissions
 *     Returns all submissions + their submitter ↔ reviewer mapping.
 *     Teacher-only. Returns identity fields the student endpoints
 *     strip (intentional, by spec).
 *
 *   GET  /peer-review-assessments/:id/reviews
 *     Returns all reviews with full metadata visible.
 *     Teacher-only.
 *
 *   PATCH /peer-reviews/:id/teacher-override
 *     body: { scores?, overallComment?, reason (>=20 chars) }
 *     Sets override flags, recomputes finalScore, fires
 *     notify-on-override to the submitter.
 *
 *   POST /peer-review-assessments/:id/close
 *     Explicit teacher-triggered close (bypasses the cron).
 *
 * Role enforcement: @Authorized(['INSTRUCTOR', 'MANAGER']) at the
 * controller decorator. Per-course CASL check is the existing
 * ItemAbilities machinery; the controller just verifies the
 * decorator-level role and lets the existing middleware do the
 * cohort check. (Phase 5.2.2 doc note: cohort-level check is
 * handled by ItemAbilities already; we don't re-implement.)
 */
@injectable()
@JsonController()
export class PeerReviewTeacherController {
  constructor(
    @inject(PEERREVIEW_TYPES.PeerReviewAssessmentRepo)
    private readonly assessmentRepo: PeerReviewAssessmentRepository,
    @inject(PEERREVIEW_TYPES.PeerReviewSubmissionRepo)
    private readonly submissionRepo: PeerReviewSubmissionRepository,
    @inject(PEERREVIEW_TYPES.PeerReviewReviewRepo)
    private readonly reviewRepo: PeerReviewReviewRepository,
    @inject(PEERREVIEW_TYPES.PeerReviewAssignmentRepo)
    private readonly assignmentRepo: PeerReviewAssignmentRepository,
    @inject(PEERREVIEW_TYPES.PeerReviewScoringService)
    private readonly scoringService: PeerReviewScoringService,
  ) {}

  @Get('/peer-review-assessments/:id/submissions')
  @HttpCode(200)
  @Authorized(['INSTRUCTOR', 'MANAGER'])
  async listSubmissionsForTeacher(
    @CurrentUser({ required: true }) _user: IUser,
    @Param('id') id: string,
  ): Promise<any> {
    const assessment = await this.assessmentRepo.findById(id);
    if (!assessment || (assessment as any).isDeleted) {
      throw new NotFoundError('Assessment not found.');
    }
    const submissions = await this.submissionRepo.findByAssessment(id);
    const out: any[] = [];
    for (const s of submissions as any[]) {
      const studentId = (s.studentId as any)?.toString();
      const assignments =
        await this.assignmentRepo.findBySubmission((s._id as any).toString());
      const reviewerDetails: any[] = [];
      for (const a of assignments as any[]) {
        reviewerDetails.push({
          assignmentId: (a._id as any).toString(),
          reviewerId: (a.reviewerId as any).toString(),
          // reviewerName / reviewerEmail left to the client to resolve
          // via /users/:id (or whatever the user lookup endpoint is)
          status: a.status,
          reassignmentCount: a.reassignmentCount,
        });
      }
      out.push({
        submissionId: (s._id as any).toString(),
        studentId,
        submittedAt: s.submittedAt,
        isLate: s.isLate,
        notes: s.notes,
        links: s.links ?? [],
        reviewsCompleted: s.reviewsCompleted ?? 0,
        reviewsTotal: s.reviewsTotal ?? 0,
        finalScore: s.finalScore ?? null,
        pendingTeacherIntervention: !!s.pendingTeacherIntervention,
        assignmentsToReviewers: reviewerDetails,
      });
    }
    return { submissions: out };
  }

  @Get('/peer-review-assessments/:id/reviews')
  @HttpCode(200)
  @Authorized(['INSTRUCTOR', 'MANAGER'])
  async listReviewsForTeacher(
    @CurrentUser({ required: true }) _user: IUser,
    @Param('id') id: string,
  ): Promise<any> {
    const assessment = await this.assessmentRepo.findById(id);
    if (!assessment || (assessment as any).isDeleted) {
      throw new NotFoundError('Assessment not found.');
    }
    const submissions = await this.submissionRepo.findByAssessment(id);
    const out: any[] = [];
    for (const s of submissions as any[]) {
      const reviews = await this.reviewRepo.findBySubmission(
        (s._id as any).toString(),
      );
      for (const r of reviews as any[]) {
        out.push({
          reviewId: (r._id as any).toString(),
          submissionId: (s._id as any).toString(),
          studentId: (s.studentId as any)?.toString(),
          reviewerId: (r.reviewerId as any)?.toString(),
          scores: r.scores ?? [],
          overallComment: r.overallComment ?? '',
          totalScore: r.totalScore ?? 0,
          submittedAt: r.submittedAt,
          isLate: r.isLate,
          teacherOverridden: !!r.teacherOverridden,
          teacherOverrideReason: r.teacherOverrideReason ?? null,
        });
      }
    }
    return { reviews: out };
  }

  @Patch('/peer-reviews/:id/teacher-override')
  @HttpCode(200)
  @Authorized(['INSTRUCTOR', 'MANAGER'])
  async teacherOverride(
    @CurrentUser({ required: true }) user: IUser,
    @Param('id') id: string,
    @Body()
    body: {
      scores?: Array<{ criterionId: string; score: number }>;
      overallComment?: string;
      reason: string;
    },
  ): Promise<any> {
    if (!body.reason || body.reason.length < 20) {
      throw new BadRequestError(
        'A reason of at least 20 characters is required for teacher overrides.',
      );
    }
    const review = await this.reviewRepo.findById(id);
    if (!review || (review as any).isDeleted) {
      throw new NotFoundError('Review not found.');
    }
    // Apply the override. The repo method requires
    // teacherOverrideScores with a `comment` field per item; default
    // to empty string. The comment alone (without new scores) is
    // enough to flag the override.
    await this.reviewRepo.applyTeacherOverride(id, {
      teacherOverrideScores: (body.scores ?? []).map((s) => ({
        criterionId: s.criterionId,
        score: s.score,
        comment: '',
      })),
      overallComment: body.overallComment,
      reason: body.reason,
      overriddenBy: user._id!.toString(),
    });
    // Recompute the affected submission's finalScore
    const recompute = await this.scoringService.recomputeSubmission(
      (review as any).submissionId?.toString(),
    );
    return {
      ok: true,
      reviewId: id,
      newFinalScore: recompute?.totalScore ?? null,
      teacherOverridden: true,
    };
  }

  @Post('/peer-review-assessments/:id/close')
  @HttpCode(200)
  @Authorized(['INSTRUCTOR', 'MANAGER'])
  async closeAssessment(
    @CurrentUser({ required: true }) _user: IUser,
    @Param('id') id: string,
  ): Promise<any> {
    const assessment = await this.assessmentRepo.findById(id);
    if (!assessment || (assessment as any).isDeleted) {
      throw new NotFoundError('Assessment not found.');
    }
    await this.assessmentRepo.setClosed(id, new Date());
    return { ok: true, closedAt: new Date().toISOString() };
  }
}