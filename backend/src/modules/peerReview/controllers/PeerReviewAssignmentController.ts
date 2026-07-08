import {
  JsonController,
  Get,
  Post,
  Param,
  Body,
  QueryParam,
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
import { PeerReviewAssignmentRepository } from '../repositories/providers/mongodb/PeerReviewAssignmentRepository.js';
import { PeerReviewSubmissionRepository } from '../repositories/providers/mongodb/PeerReviewSubmissionRepository.js';
import { PeerReviewAssessmentRepository } from '../repositories/providers/mongodb/PeerReviewAssessmentRepository.js';
import { PeerReviewReviewRepository } from '../repositories/providers/mongodb/PeerReviewReviewRepository.js';
import { IUser, IPeerReviewReview, PeerReviewAssignmentStatus } from '#shared/interfaces/models.js';
import {
  stripSubmitterIdentity,
  stripReviewerIdentity,
} from '../utils/doubleBlindFilters.js';

/**
 * Reviewer-side HTTP endpoints (student-facing double-blind flow).
 *
 * Phase 4.2.3 deliverable. Routes:
 *
 *   GET  /students/me/peer-review-assignments
 *     Lists the current user's pending reviews. NEVER includes
 *     submitter identity.
 *
 *   GET  /peer-review-assignments/:id/submission
 *     Returns the submission to review (notes + links). Server-side
 *     validates the requester is the assigned reviewer; otherwise 403.
 *     NEVER includes submitter identity.
 *
 *   POST /peer-review-assignments/:id/review
 *     Submits a review (per-criterion scores + comments). Validates
 *     every rubric criterion has a score, and score ≤ maxPoints.
 *
 *   GET  /students/me/peer-reviews-received?assessmentId=...
 *     Returns reviews on the current user's OWN submissions, with
 *     reviewer identity stripped (double-blind). Once all reviews are
 *     in, also returns finalScore.
 *
 * DOUBLE-BLIND ENFORCEMENT: every payload is built via the helper
 * `stripSubmitterIdentity()` / `stripReviewerIdentity()` which returns
 * a fresh JSON-safe copy with the offending fields removed. There is
 * NO branch in the controller that returns submitter or reviewer
 * identity to the wrong audience.
 */
@injectable()
@JsonController()
export class PeerReviewAssignmentController {
  constructor(
    @inject(PEERREVIEW_TYPES.PeerReviewAssignmentRepo)
    private readonly assignmentRepo: PeerReviewAssignmentRepository,
    @inject(PEERREVIEW_TYPES.PeerReviewSubmissionRepo)
    private readonly submissionRepo: PeerReviewSubmissionRepository,
    @inject(PEERREVIEW_TYPES.PeerReviewAssessmentRepo)
    private readonly assessmentRepo: PeerReviewAssessmentRepository,
    @inject(PEERREVIEW_TYPES.PeerReviewReviewRepo)
    private readonly reviewRepo: PeerReviewReviewRepository,
  ) {}

  @Get('/students/me/peer-review-assignments')
  @HttpCode(200)
  @Authorized()
  async listMine(
    @CurrentUser({ required: true }) user: IUser,
  ): Promise<any[]> {
    const raw = await this.assignmentRepo.findPendingForReviewer(
      user._id!.toString(),
    );
    // Strip any submitter identity (defense in depth — the repo only
    // returns reviewerId+submissionId, never studentId, but we make
    // sure).
    return raw.map((a: any) => stripSubmitterIdentity(a));
  }

  @Get('/peer-review-assignments/:id/submission')
  @HttpCode(200)
  @Authorized()
  async getSubmissionToReview(
    @CurrentUser({ required: true }) user: IUser,
    @Param('id') id: string,
  ): Promise<any> {
    const assignment = await this.assignmentRepo.findById(id);
    if (!assignment || (assignment as any).isDeleted) {
      throw new NotFoundError('Assignment not found.');
    }
    // CRITICAL: enforce that the requester IS the assigned reviewer.
    // If not, return 403 — never leak the submission to a stranger.
    if ((assignment as any).reviewerId?.toString() !== user._id!.toString()) {
      throw new ForbiddenError(
        'You are not the assigned reviewer for this submission.',
      );
    }
    if (
      (assignment as any).status === 'SUBMITTED' ||
      (assignment as any).status === 'REASSIGNED'
    ) {
      throw new BadRequestError(
        'This assignment is no longer reviewable.',
      );
    }
    const submission = await this.submissionRepo.findById(
      (assignment as any).submissionId?.toString(),
    );
    if (!submission) {
      throw new NotFoundError('Submission not found.');
    }
    const assessment = await this.assessmentRepo.findById(
      (submission as any).assessmentId?.toString(),
    );
    return {
      assignmentId: (assignment as any)._id?.toString(),
      assessmentTitle: (assessment as any)?.title,
      rubric: (assessment as any)?.rubric,
      submissionDeadline: (submission as any)?.submittedAt,
      notes: (submission as any)?.notes ?? '',
      links: (submission as any)?.links ?? [],
      dueAt: (assignment as any)?.dueAt,
      // NO studentId, studentName, studentEmail, studentFirebaseUID —
      // double-blind guarantee for student audience.
    };
  }

  @Post('/peer-review-assignments/:id/review')
  @HttpCode(201)
  @Authorized()
  async submitReview(
    @CurrentUser({ required: true }) user: IUser,
    @Param('id') id: string,
    @Body() body: { scores: any[]; overallComment: string },
  ): Promise<{ reviewId: string }> {
    const assignment = await this.assignmentRepo.findById(id);
    if (!assignment) throw new NotFoundError('Assignment not found.');
    if ((assignment as any).reviewerId?.toString() !== user._id!.toString()) {
      throw new ForbiddenError(
        'You are not the assigned reviewer for this submission.',
      );
    }
    if ((assignment as any).status === 'SUBMITTED') {
      throw new BadRequestError(
        'A review has already been submitted for this assignment.',
      );
    }
    const assessment = await this.assessmentRepo.findById(
      (assignment as any).assessmentId?.toString(),
    );
    if (!assessment) throw new NotFoundError('Assessment not found.');
    // Validate every rubric criterion has a score
    const rubric = (assessment as any).rubric as Array<{
      criterionId: string;
      maxPoints: number;
    }>;
    if (!body.scores || body.scores.length !== rubric.length) {
      throw new BadRequestError(
        `Expected ${rubric.length} criterion scores, got ${body.scores?.length ?? 0}.`,
      );
    }
    let totalScore = 0;
    for (const rubricItem of rubric) {
      const scoreObj = body.scores.find(
        (s) => s.criterionId === rubricItem.criterionId,
      );
      if (!scoreObj) {
        throw new BadRequestError(
          `Missing score for criterion ${rubricItem.criterionId}.`,
        );
      }
      if (
        typeof scoreObj.score !== 'number' ||
        scoreObj.score < 0 ||
        scoreObj.score > rubricItem.maxPoints
      ) {
        throw new BadRequestError(
          `Invalid score for ${rubricItem.criterionId}: must be 0..${rubricItem.maxPoints}.`,
        );
      }
      totalScore += scoreObj.score;
    }
    const review: IPeerReviewReview = {
      assignmentId: new ObjectId(id) as any,
      assessmentId: (assignment as any).assessmentId,
      submissionId: (assignment as any).submissionId,
      reviewerId: new ObjectId(user._id!.toString()) as any,
      cohortId: (assignment as any).cohortId,
      scores: body.scores,
      overallComment: body.overallComment ?? '',
      totalScore,
      submittedAt: new Date(),
      isLate: new Date() > (assignment as any).dueAt,
      teacherOverridden: false,
    };
    const reviewId = await this.reviewRepo.create(review);
    await this.assignmentRepo.setSubmittedReviewId(id, reviewId);
    await this.submissionRepo.incrementReviewsCompleted(
      (assignment as any).submissionId?.toString(),
    );
    return { reviewId };
  }

  @Get('/students/me/peer-reviews-received')
  @HttpCode(200)
  @Authorized()
  async getReviewsReceived(
    @CurrentUser({ required: true }) user: IUser,
    @QueryParam('assessmentId') assessmentId?: string,
  ): Promise<any> {
    if (!assessmentId) {
      throw new BadRequestError('assessmentId is required.');
    }
    // Fetch the user's own submissions for this assessment.
    const submissions = await this.submissionRepo.findByStudent(
      user._id!.toString(),
    );
    const mySubs = submissions.filter(
      (s: any) => (s.assessmentId as any).toString() === assessmentId,
    );
    if (mySubs.length === 0) {
      return { reviews: [], finalScore: null };
    }
    // For each submission, fetch its reviews and strip reviewer identity.
    const allReviews: any[] = [];
    for (const sub of mySubs) {
      const reviews = await this.reviewRepo.findBySubmission(
        (sub as any)._id?.toString(),
      );
      for (const r of reviews) {
        allReviews.push(stripReviewerIdentity(r));
      }
    }
    const finalScore =
      mySubs.length === 1 && mySubs[0] && (mySubs[0] as any).finalScore
        ? (mySubs[0] as any).finalScore
        : null;
    return { reviews: allReviews, finalScore };
  }
}

// stripSubmitterIdentity / stripReviewerIdentity live in
// ../utils/doubleBlindFilters.ts so they can be unit-tested in
// isolation (Phase 4.2.6 leak tests).
