import { injectable, inject } from 'inversify';
import { PEERREVIEW_TYPES } from '../types.js';
import { PeerReviewAssessmentRepository } from '../repositories/providers/mongodb/PeerReviewAssessmentRepository.js';
import { PeerReviewSubmissionRepository } from '../repositories/providers/mongodb/PeerReviewSubmissionRepository.js';
import { PeerReviewScoringService } from '../services/PeerReviewScoringService.js';
import { PeerReviewNotificationService } from '../services/PeerReviewNotificationService.js';

/**
 * FinalizationRunner — fires after the review deadline.
 *
 * For each assessment whose reviewDeadline has passed and whose
 * assignment algorithm has already run:
 *   1. Score every submission via PeerReviewScoringService.scoreSubmission.
 *   2. Fire notifyScoreReady per submitter.
 *   3. Stamp closedAt (idempotent — if already set, no-op).
 *
 * Idempotent: each submission has finalScoreLockedAt once scored; we
 * skip ones that are already locked so a re-run doesn't double-fire
 * notifications.
 *
 * Phase 4.2.2 + Phase 5.2.5 finalization wiring.
 * Runs every minute via node-cron.
 */
@injectable()
export class FinalizationRunner {
  constructor(
    @inject(PEERREVIEW_TYPES.PeerReviewAssessmentRepo)
    private readonly assessmentRepo: PeerReviewAssessmentRepository,
    @inject(PEERREVIEW_TYPES.PeerReviewSubmissionRepo)
    private readonly submissionRepo: PeerReviewSubmissionRepository,
    @inject(PEERREVIEW_TYPES.PeerReviewScoringService)
    private readonly scoringService: PeerReviewScoringService,
    @inject(PEERREVIEW_TYPES.PeerReviewNotificationService)
    private readonly notifier: PeerReviewNotificationService,
  ) {}

  async runNow(now: Date = new Date()): Promise<{
    finalized: number;
    notified: number;
    errors: Array<{ assessmentId: string; error: string }>;
  }> {
    const due = await this.assessmentRepo.findDueForFinalization(now);
    let finalized = 0;
    let notified = 0;
    const errors: Array<{ assessmentId: string; error: string }> = [];
    for (const a of due) {
      const aid = (a._id as any).toString();
      try {
        const submissions = await this.submissionRepo.findByAssessment(aid);
        // Skip already-finalized submissions (finalScoreLockedAt is set
        // when ScoringService writes the score).
        const toScore = (submissions as any[]).filter(
          (s) => !s.finalScoreLockedAt,
        );
        if (toScore.length === 0) {
          continue;
        }
        for (const s of toScore) {
          const subId = (s._id as any).toString();
          try {
            const score = await this.scoringService.scoreSubmission(subId);
            if (
              score &&
              !score.pendingForTeacher &&
              !(s as any).teacherOverridden
            ) {
              await this.notifier.notifyScoreReady({
                userId: (s as any).studentId,
                assessmentTitle:
                  (a as any).title ?? 'Peer-review assessment',
                finalScore: score.totalScore,
                totalMax: (a as any).totalMaxPoints,
                assessmentId: aid,
                courseId: (a as any).courseId?.toString(),
              });
              notified++;
            }
          } catch (err) {
            console.warn(
              `[FinalizationRunner] scoreSubmission failed for ${subId}:`,
              err,
            );
          }
        }
        // Stamp closedAt so the assessment is fully finalized. If this
        // throws, the next tick retries the submissions (idempotent
        // because finalScoreLockedAt is set).
        if (!(a as any).closedAt) {
          await this.assessmentRepo.setClosed(aid, new Date());
        }
        finalized++;
      } catch (e: any) {
        errors.push({ assessmentId: aid, error: String(e?.message ?? e) });
      }
    }
    return { finalized, notified, errors };
  }

  scheduleCron(): void {
    import('node-cron').then(({default: cron}) => {
      cron.schedule('*/1 * * * *', async () => {
        try {
          const r = await this.runNow();
          if (r.finalized > 0) {
            console.log(
              `[FinalizationRunner] finalized=${r.finalized} notified=${r.notified} errors=${r.errors.length}`,
            );
          }
        } catch (e) {
          console.error('[FinalizationRunner] cron error', e);
        }
      });
    });
  }
}