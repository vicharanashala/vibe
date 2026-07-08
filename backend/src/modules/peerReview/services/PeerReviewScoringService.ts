import { injectable, inject } from 'inversify';
import { ObjectId } from 'mongodb';
import { BaseService } from '#root/shared/classes/BaseService.js';
import { MongoDatabase } from '#shared/database/providers/mongo/MongoDatabase.js';
import { GLOBAL_TYPES } from '#root/types.js';
import { PEERREVIEW_TYPES } from '../types.js';
import { PeerReviewAssessmentRepository } from '../repositories/providers/mongodb/PeerReviewAssessmentRepository.js';
import { PeerReviewSubmissionRepository } from '../repositories/providers/mongodb/PeerReviewSubmissionRepository.js';
import { PeerReviewReviewRepository } from '../repositories/providers/mongodb/PeerReviewReviewRepository.js';
import { PeerReviewNotificationService } from './PeerReviewNotificationService.js';
import { computeFinalScore } from '../utils/scoreComputation.js';

/**
 * PeerReviewScoringService — wraps computeFinalScore with all the DB
 * I/O needed to actually run it.
 *
 * Phase 5.2.1 deliverable (commit 2 of 5). Two public methods:
 *
 *   - scoreSubmission(submissionId): single-shot score write. Used by
 *     FinalizationRunner after the review deadline passes.
 *   - recomputeSubmission(submissionId): re-runs with current
 *     rubric and reviews. Used by the teacher-override endpoint and
 *     the assessment-edit flow.
 *
 * Both methods stamp the submission's finalScore, finalScoreBreakdown,
 * finalScoreLockedAt. They do NOT lock the assessment — that's the
 * FinalizationRunner's job (which sets closedAt on the assessment).
 *
 * Audit-trail emission is stubbed (request context plumbing lands in
 * Phase 6 with the e2e spec). The doc-prescribed
 * AuditAction.PEER_REVIEW_SCORE_COMPUTED enum value is reserved from
 * Phase 1 commit 4.
 */
@injectable()
export class PeerReviewScoringService extends BaseService {
  constructor(
    @inject(PEERREVIEW_TYPES.PeerReviewAssessmentRepo)
    private readonly assessmentRepo: PeerReviewAssessmentRepository,
    @inject(PEERREVIEW_TYPES.PeerReviewSubmissionRepo)
    private readonly submissionRepo: PeerReviewSubmissionRepository,
    @inject(PEERREVIEW_TYPES.PeerReviewReviewRepo)
    private readonly reviewRepo: PeerReviewReviewRepository,
    @inject(PEERREVIEW_TYPES.PeerReviewNotificationService)
    private readonly notifier: PeerReviewNotificationService,
    @inject(GLOBAL_TYPES.Database)
    database: MongoDatabase,
  ) {
    super(database);
  }

  /**
   * Compute + persist the final score for a single submission.
   * Returns the result (or undefined if submission not found).
   */
  async scoreSubmission(
    submissionId: string,
  ): Promise<
    | {
        totalScore: number;
        pendingForTeacher: boolean;
        teacherOverridden: boolean;
      }
    | undefined
  > {
    const submission = await this.submissionRepo.findById(submissionId);
    if (!submission || (submission as any).isDeleted) return undefined;
    const assessment = await this.assessmentRepo.findById(
      (submission as any).assessmentId?.toString(),
    );
    if (!assessment) return undefined;
    const reviews = await this.reviewRepo.findBySubmission(submissionId);
    return this.computeAndPersist(
      submissionId,
      assessment,
      submission,
      reviews as any,
    );
  }

  /**
   * Re-runs scoreSubmission's logic. Used by the teacher-override
   * endpoint after an override was applied.
   */
  async recomputeSubmission(
    submissionId: string,
  ): Promise<
    | {
        totalScore: number;
        pendingForTeacher: boolean;
        teacherOverridden: boolean;
      }
    | undefined
  > {
    return this.scoreSubmission(submissionId);
  }

  private async computeAndPersist(
    submissionId: string,
    assessment: any,
    submission: any,
    reviews: any[],
  ): Promise<{
    totalScore: number;
    pendingForTeacher: boolean;
    teacherOverridden: boolean;
  }> {
    const result = computeFinalScore({
      rubric: (assessment as any).rubric ?? [],
      reviews: reviews.map((r: any) => ({
        scores: r.scores ?? [],
        teacherOverridden: !!r.teacherOverridden,
        teacherOverrideScores: r.teacherOverrideScores,
      })),
      latePolicy: (assessment as any).config?.latePolicy ?? 'penalty-only',
      latePenaltyPercent: (assessment as any).config?.latePenaltyPercent ?? 10,
      isSubmissionLate: !!(submission as any).isLate,
    });

    await this.submissionRepo.setFinalScore(
      submissionId,
      result.totalScore,
      result.breakdown,
    );
    if (result.pendingForTeacher) {
      // Caller (FinalizationRunner) will surface to teacher
      // separately. We persist the null finalScore to make it
      // explicit on the row.
      await this.submissionRepo.clearFinalScore(submissionId);
    }
    return {
      totalScore: result.totalScore,
      pendingForTeacher: !!result.pendingForTeacher,
      teacherOverridden: result.teacherOverridden,
    };
  }
}