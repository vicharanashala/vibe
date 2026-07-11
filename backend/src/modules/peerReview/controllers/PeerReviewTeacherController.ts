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
  Req,
} from 'routing-controllers';
import { injectable, inject } from 'inversify';
import { ObjectId } from 'mongodb';
import { PEERREVIEW_TYPES } from '../types.js';
import { PeerReviewAssessmentRepository } from '../repositories/providers/mongodb/PeerReviewAssessmentRepository.js';
import { PeerReviewSubmissionRepository } from '../repositories/providers/mongodb/PeerReviewSubmissionRepository.js';
import { PeerReviewReviewRepository } from '../repositories/providers/mongodb/PeerReviewReviewRepository.js';
import { PeerReviewAssignmentRepository } from '../repositories/providers/mongodb/PeerReviewAssignmentRepository.js';
import { PeerReviewScoringService } from '../services/PeerReviewScoringService.js';
import { PeerReviewNotificationService } from '../services/PeerReviewNotificationService.js';
import { IUser } from '#shared/interfaces/models.js';
import { setAuditTrail } from '#root/utils/setAuditTrail.js';
import { AuditCategory, AuditAction } from '#root/modules/auditTrails/interfaces/IAuditTrails.js';
import { GLOBAL_TYPES } from '#root/types.js';
import { IUserRepository } from '#root/shared/database/interfaces/IUserRepository.js';

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
 * NOTE: explicit teacher-triggered close lives in
 * PeerReviewAssessmentController (`POST /peer-review-assessments/:id/close`),
 * which calls the real PeerReviewAssessmentService.close() — algorithm + notify.
 * Do NOT add a stub close here; it would shadow the real route.
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
    @inject(PEERREVIEW_TYPES.PeerReviewNotificationService)
    private readonly notifier: PeerReviewNotificationService,
    @inject(GLOBAL_TYPES.UserRepo)
    private readonly userRepo: IUserRepository,
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
    const submissionsWithAssignments: any[] = [];
    const allUserIds = new Set<string>();

    for (const s of submissions as any[]) {
      const studentId = (s.studentId as any)?.toString();
      if (studentId) allUserIds.add(studentId);

      const assignments = await this.assignmentRepo.findBySubmission((s._id as any).toString());
      for (const a of assignments as any[]) {
        const reviewerId = (a.reviewerId as any)?.toString();
        if (reviewerId) allUserIds.add(reviewerId);
      }
      submissionsWithAssignments.push({ s, assignments });
    }

    const usersList = await this.userRepo.getUsersByIds(Array.from(allUserIds));
    const userMap = new Map<string, { name: string; email: string }>();
    for (const u of usersList) {
      userMap.set(u._id!.toString(), {
        name: `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email,
        email: u.email,
      });
    }

    const out: any[] = [];
    for (const { s, assignments } of submissionsWithAssignments) {
      const studentId = (s.studentId as any)?.toString();
      const reviewerDetails: any[] = [];
      for (const a of assignments as any[]) {
        const reviewerId = (a.reviewerId as any)?.toString();
        reviewerDetails.push({
          assignmentId: (a._id as any).toString(),
          reviewerId,
          reviewerName: userMap.get(reviewerId)?.name || 'Unknown',
          reviewerEmail: userMap.get(reviewerId)?.email || '',
          status: a.status,
          reassignmentCount: a.reassignmentCount,
        });
      }
      out.push({
        submissionId: (s._id as any).toString(),
        studentId,
        studentName: userMap.get(studentId)?.name || 'Unknown',
        studentEmail: userMap.get(studentId)?.email || '',
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
    const allUserIds = new Set<string>();
    const reviewsWithDetails: any[] = [];

    for (const s of submissions as any[]) {
      const studentId = (s.studentId as any)?.toString();
      if (studentId) allUserIds.add(studentId);

      const reviews = await this.reviewRepo.findBySubmission(
        (s._id as any).toString(),
      );
      for (const r of reviews as any[]) {
        const reviewerId = (r.reviewerId as any)?.toString();
        if (reviewerId) allUserIds.add(reviewerId);
        reviewsWithDetails.push({ r, studentId });
      }
    }

    const usersList = await this.userRepo.getUsersByIds(Array.from(allUserIds));
    const userMap = new Map<string, { name: string; email: string }>();
    for (const u of usersList) {
      userMap.set(u._id!.toString(), {
        name: `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email,
        email: u.email,
      });
    }

    const out: any[] = [];
    for (const { r, studentId } of reviewsWithDetails) {
      const reviewerId = (r.reviewerId as any)?.toString();
      out.push({
        reviewId: (r._id as any).toString(),
        submissionId: (r.submissionId as any).toString(),
        studentId,
        studentName: userMap.get(studentId)?.name || 'Unknown',
        studentEmail: userMap.get(studentId)?.email || '',
        reviewerId,
        reviewerName: userMap.get(reviewerId)?.name || 'Unknown',
        reviewerEmail: userMap.get(reviewerId)?.email || '',
        scores: r.scores ?? [],
        overallComment: r.overallComment ?? '',
        totalScore: r.totalScore ?? 0,
        submittedAt: r.submittedAt,
        isLate: r.isLate,
        teacherOverridden: !!r.teacherOverridden,
        teacherOverrideReason: r.teacherOverrideReason ?? null,
      });
    }
    return { reviews: out };
  }

  @Patch('/peer-reviews/:id/teacher-override')
  @HttpCode(200)
  @Authorized(['INSTRUCTOR', 'MANAGER'])
  async teacherOverride(
    @Req() req: any,
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
    // Look up the assessment for the notification payload (Phase 5.2.4
    // notify-on-override requires the assessment's title + rubric for
    // the message body).
    const assessment = await this.assessmentRepo.findById(
      (review as any).assessmentId?.toString(),
    );
    if (!assessment || (assessment as any).isDeleted) {
      throw new NotFoundError('Assessment not found for this review.');
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
    // Fire notify-on-override to the submitter (Phase 5.2.4 spec).
    // Submitter is on the linked submission; fetch to get studentId
    // for the notification payload. The assessment was loaded above
    // (variable `assessment` is in scope from line 153).
    const submission = await this.submissionRepo.findById(
      (review as any).submissionId?.toString(),
    );
    if (submission && recompute && assessment) {
      const rubric = (assessment as any).rubric ?? [];
      const totalMax = rubric.reduce(
        (acc: number, c: any) => acc + (c.maxPoints ?? 0),
        0,
      );
      await this.notifier.notifyTeacherOverride({
        userId: (submission as any).studentId?.toString() ?? '',
        assessmentTitle: (assessment as any).title ?? 'Assessment',
        newFinalScore: recompute.totalScore,
        totalMax,
        assessmentId: id,
        courseId: (assessment as any).courseId?.toString(),
        reason: body.reason,
      });
    }
    // Audit log (Phase 7 audit-improvement tier-2.b).
    setAuditTrail(req, {
      category: AuditCategory.PEER_REVIEW,
      action: AuditAction.PEER_REVIEW_TEACHER_OVERRIDE,
      actor: {
        id: new ObjectId(user._id!.toString()),
        name: `${user.firstName} ${user.lastName}`,
        email: user.email,
        role: user.roles,
      },
      context: {
        peerReviewAssessmentId: (assessment as any)._id?.toString() as any,
      },
      changes: {
        after: {
          reason: body.reason,
          newFinalScore: recompute?.totalScore ?? null,
        },
      },
    });
    return {
      ok: true,
      reviewId: id,
      newFinalScore: recompute?.totalScore ?? null,
      teacherOverridden: true,
    };
  }

  // closeAssessment intentionally removed — it was a stub that just
  // stamped closedAt and never ran the assignment algorithm or fired
  // notifications. The real close lives in
  // PeerReviewAssessmentController.close → PeerReviewAssessmentService.close().
}