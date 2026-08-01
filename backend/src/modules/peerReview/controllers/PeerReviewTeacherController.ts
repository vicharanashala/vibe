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

      const activeAssignments = (assignments as any[]).filter((a: any) => a.status !== 'EXCLUDED' && a.status !== 'CANCELLED');
      const submittedAssignments = (assignments as any[]).filter((a: any) => a.status === 'SUBMITTED');

      const actualReviewsTotal = activeAssignments.length > 0
        ? activeAssignments.length
        : (s.reviewsTotal || (assessment as any).config?.reviewsPerSubmission || 3);
      const actualReviewsCompleted = submittedAssignments.length;

      let finalScore = s.teacherOverridden && typeof s.teacherOverrideScore === 'number'
        ? s.teacherOverrideScore
        : (s.finalScore ?? null);

      if (
        finalScore === null &&
        (actualReviewsCompleted > 0 || (assessment as any).closedAt)
      ) {
        try {
          const res = await this.scoringService.scoreSubmission(
            (s._id as any).toString(),
          );
          if (res && typeof res.totalScore === 'number') {
            finalScore = res.totalScore;
          }
        } catch (err) {
          console.warn(
            `[listSubmissionsForTeacher] auto-score failed for ${(s._id as any).toString()}:`,
            err,
          );
        }
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
        reviewsCompleted: actualReviewsCompleted,
        reviewsTotal: actualReviewsTotal,
        finalScore,
        teacherOverridden: !!s.teacherOverridden,
        teacherOverrideScore: s.teacherOverrideScore ?? null,
        teacherOverrideReason: s.teacherOverrideReason ?? null,
        excludedFromPeerReview: !!s.excludedFromPeerReview || !!s.reviewerExcluded,
        reviewerExcluded: !!s.reviewerExcluded || !!s.excludedFromPeerReview,
        teacherExcludeReason: s.teacherExcludeReason ?? null,
        pendingTeacherIntervention: !!s.pendingTeacherIntervention,
        assignmentsToReviewers: reviewerDetails,
      });
    }
    return { submissions: out };
  }

  @Patch('/peer-review-assessments/submissions/:submissionId/teacher-override')
  @HttpCode(200)
  @Authorized(['INSTRUCTOR', 'MANAGER'])
  async teacherOverrideSubmissionFinalScore(
    @Req() req: any,
    @CurrentUser({ required: true }) user: IUser,
    @Param('submissionId') submissionId: string,
    @Body()
    body: {
      finalScore?: number;
      scores?: Array<{ criterionId: string; score: number }>;
      reason?: string;
      reset?: boolean;
    },
  ): Promise<any> {
    const submission = await this.submissionRepo.findById(submissionId);
    if (!submission || (submission as any).isDeleted) {
      throw new NotFoundError('Submission not found.');
    }

    if (body.reset) {
      await this.submissionRepo.clearTeacherOverride(submissionId);
      const recompute = await this.scoringService.recomputeSubmission(submissionId);
      return { success: true, reset: true, finalScore: recompute?.totalScore ?? null };
    }

    if (!body.reason || body.reason.length < 20) {
      throw new BadRequestError(
        'A reason of at least 20 characters is required for teacher overrides.',
      );
    }

    const assessment = await this.assessmentRepo.findById(
      (submission as any).assessmentId?.toString(),
    );
    const rubric = (assessment as any)?.rubric ?? [];

    let finalScore = body.finalScore;
    const scores = body.scores ?? [];
    if (scores.length > 0) {
      finalScore = scores.reduce((acc, s) => acc + (Number(s.score) || 0), 0);
    } else if (typeof finalScore !== 'number' || Number.isNaN(finalScore)) {
      throw new BadRequestError('A valid numeric finalScore or rubric scores list is required.');
    }

    const breakdown = rubric.map((c: any) => {
      const item = scores.find((s) => s.criterionId === c.criterionId);
      return {
        criterionId: c.criterionId,
        meanScore: item ? Number(item.score) : 0,
        maxPoints: c.maxPoints,
      };
    });

    await this.submissionRepo.applyTeacherOverride(submissionId, {
      finalScore: finalScore!,
      breakdown,
      scores,
      reason: body.reason,
      overriddenBy: user._id!.toString(),
    });

    if (assessment) {
      const totalMax = rubric.reduce(
        (acc: number, c: any) => acc + (c.maxPoints ?? 0),
        0,
      );
      await this.notifier.notifyTeacherOverride({
        userId: (submission as any).studentId?.toString() ?? '',
        assessmentTitle: (assessment as any).title ?? 'Assessment',
        newFinalScore: finalScore!,
        totalMax,
        assessmentId: (assessment as any)._id?.toString(),
        courseId: (assessment as any).courseId?.toString(),
        reason: body.reason,
      });
    }

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
        peerReviewAssessmentId: (assessment as any)?._id?.toString() as any,
      },
      changes: {
        after: {
          reason: body.reason,
          newFinalScore: body.finalScore,
        },
      },
    });

    return {
      ok: true,
      submissionId,
      finalScore: body.finalScore,
      teacherOverridden: true,
    };
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
      const assignmentId = (r.assignmentId as any)?.toString();
      const assignment = assignmentId ? await this.assignmentRepo.findById(assignmentId) : null;
      const isExcludedAssignment = assignment?.status === 'EXCLUDED';
      if (isExcludedAssignment) {
        continue;
      }
      const isOverridden = !!r.teacherOverridden;
      const effectiveScores =
        isOverridden && r.teacherOverrideScores && r.teacherOverrideScores.length > 0
          ? r.teacherOverrideScores
          : (r.scores ?? []);
      const effectiveTotalScore =
        isOverridden && r.teacherOverrideScores && r.teacherOverrideScores.length > 0
          ? effectiveScores.reduce((sum: number, s: any) => sum + (s.score ?? 0), 0)
          : (r.totalScore ?? 0);

      out.push({
        reviewId: (r._id as any).toString(),
        submissionId: (r.submissionId as any).toString(),
        studentId,
        studentName: userMap.get(studentId)?.name || 'Unknown',
        studentEmail: userMap.get(studentId)?.email || '',
        reviewerId,
        reviewerName: userMap.get(reviewerId)?.name || 'Unknown',
        reviewerEmail: userMap.get(reviewerId)?.email || '',
        scores: effectiveScores,
        originalScores: r.scores ?? [],
        overallComment: r.overallComment ?? '',
        totalScore: effectiveTotalScore,
        originalTotalScore: r.totalScore ?? 0,
        submittedAt: r.submittedAt,
        isLate: r.isLate,
        isExcludedAssignment,
        teacherOverridden: isOverridden,
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
      reason?: string;
      reset?: boolean;
    },
  ): Promise<any> {
    const review = await this.reviewRepo.findById(id);
    if (!review || (review as any).isDeleted) {
      throw new NotFoundError('Review not found.');
    }
    const subId = (review as any).submissionId?.toString();

    if (body.reset) {
      await this.reviewRepo.clearTeacherOverride(id);
      if (subId) {
        await this.scoringService.recomputeSubmission(subId);
      }
      return { success: true, reset: true };
    }

    if (!body.reason || body.reason.length < 20) {
      throw new BadRequestError(
        'A reason of at least 20 characters is required for teacher overrides.',
      );
    }
    // Look up the assessment for the notification payload
    const assessment = await this.assessmentRepo.findById(
      (review as any).assessmentId?.toString(),
    );
    if (!assessment || (assessment as any).isDeleted) {
      throw new NotFoundError('Assessment not found for this review.');
    }
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

  @Post('/peer-review-assessments/submissions/:submissionId/exclude-student')
  @HttpCode(200)
  @Authorized(['INSTRUCTOR', 'MANAGER'])
  async excludeStudentFromPeerReview(
    @Req() req: any,
    @CurrentUser({ required: true }) user: IUser,
    @Param('submissionId') submissionId: string,
    @Body()
    body: {
      reason?: string;
      reset?: boolean;
    },
  ): Promise<any> {
    const submission = await this.submissionRepo.findById(submissionId);
    if (!submission || (submission as any).isDeleted) {
      throw new NotFoundError('Submission not found.');
    }

    const assessmentId = (submission as any).assessmentId?.toString();
    const studentId = (submission as any).studentId?.toString();

    if (body.reset) {
      await this.submissionRepo.clearExclusion(submissionId);
      const recompute = await this.scoringService.recomputeSubmission(submissionId);
      return {
        success: true,
        reset: true,
        submissionId,
        excludedFromPeerReview: false,
        finalScore: recompute?.totalScore ?? null,
      };
    }

    if (!body.reason || body.reason.length < 20) {
      throw new BadRequestError(
        'A reason of at least 20 characters is required for excluding a student from peer review.',
      );
    }

    // 1. Mark submission as excluded
    await this.submissionRepo.excludeFromPeerReview(
      submissionId,
      body.reason,
      user._id!.toString(),
    );

    // 2. Mark assignments where this student was reviewer as EXCLUDED
    const reviewerAssignments = await this.assignmentRepo.excludeAssignmentsByReviewer(
      assessmentId,
      studentId,
    );

    // 3. For target submissions losing a reviewer, attempt replacement reassignment if candidate active reviewers exist
    const assessment = await this.assessmentRepo.findById(assessmentId);
    const allSubmissionsInAssessment = await this.submissionRepo.findByAssessment(assessmentId);
    const maxReviewsPerReviewer = (assessment as any)?.config?.reviewsPerReviewer || 3;

    for (const asn of reviewerAssignments as any[]) {
      const targetSubId = (asn.submissionId as any)?.toString();
      if (!targetSubId || targetSubId === submissionId) continue;

      const targetSub = await this.submissionRepo.findById(targetSubId);
      if (!targetSub) continue;
      const targetStudentId = (targetSub.studentId as any)?.toString();

      // Find existing assignments for targetSub
      const existingAsns = await this.assignmentRepo.findBySubmission(targetSubId);
      const assignedReviewerIds = new Set(existingAsns.map((a: any) => (a.reviewerId as any)?.toString()));

      // Look for an eligible replacement candidate in the cohort
      let replacementReviewerId: string | null = null;
      for (const candSub of allSubmissionsInAssessment as any[]) {
        const candStudentId = (candSub.studentId as any)?.toString();
        if (!candStudentId) continue;
        if (candStudentId === studentId) continue; // Exclude disqualified student
        if (candStudentId === targetStudentId) continue; // Exclude submission author
        if (assignedReviewerIds.has(candStudentId)) continue; // Already assigned

        // Check candidate active review load
        const candAsns = await this.assignmentRepo.findByReviewer(assessmentId, candStudentId);
        const activeCandAsns = candAsns.filter((a: any) => a.status !== 'EXCLUDED' && a.status !== 'CANCELLED');
        if (activeCandAsns.length < maxReviewsPerReviewer) {
          replacementReviewerId = candStudentId;
          break;
        }
      }

      if (replacementReviewerId) {
        await this.assignmentRepo.create({
          assessmentId: new ObjectId(assessmentId),
          submissionId: new ObjectId(targetSubId),
          reviewerId: new ObjectId(replacementReviewerId),
          status: 'PENDING',
          assignedAt: new Date(),
          reassignmentCount: ((asn as any).reassignmentCount || 0) + 1,
        } as any);
      }

      // Recompute target submission score from remaining valid submitted reviews
      await this.scoringService.recomputeSubmission(targetSubId);
    }

    // 4. Recompute student's own submission score (evaluating reviews received normally)
    const recompute = await this.scoringService.recomputeSubmission(submissionId);

    // 5. Audit trail
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
        peerReviewAssessmentId: assessmentId as any,
      },
      changes: {
        after: {
          action: 'STUDENT_EXCLUDED_FROM_PEER_REVIEW',
          studentId,
          submissionId,
          reason: body.reason,
        },
      },
    });

    return {
      ok: true,
      submissionId,
      studentId,
      excludedFromPeerReview: true,
      reason: body.reason,
    };
  }

  // closeAssessment intentionally removed — it was a stub that just
  // stamped closedAt and never ran the assignment algorithm or fired
  // notifications. The real close lives in
  // PeerReviewAssessmentController.close → PeerReviewAssessmentService.close().
}