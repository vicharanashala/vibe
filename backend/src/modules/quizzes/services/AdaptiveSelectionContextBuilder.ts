import { injectable, inject } from 'inversify';
import { ClientSession } from 'mongodb';
import { QUIZZES_TYPES } from '../types.js';
import { USERS_TYPES } from '#root/modules/users/types.js';
import { ProgressRepository } from '#root/shared/database/providers/mongo/repositories/ProgressRepository.js';
import { UserQuizMetricsRepository } from '../repositories/providers/mongodb/UserQuizMetricsRepository.js';
import { AttemptRepository } from '../repositories/providers/mongodb/AttemptRepository.js';
import { SelectionContext } from '#shared/interfaces/quiz.js';

/**
 * ACRE V2 — Adaptive Selection Context Builder
 *
 * Responsible for gathering and assembling the student-history data
 * required before adaptive question selection can take place.  It reads
 * from three repositories and returns a single, self-contained
 * {@link SelectionContext} that downstream services can reason about
 * without touching the database themselves.
 *
 * ## Why this class exists
 * AttemptService previously combined attempt lifecycle management with
 * history retrieval.  Extracting context construction here keeps
 * AttemptService focused on orchestration and makes the adaptive
 * pipeline independently testable.
 *
 * ## Responsibilities
 * - Determine whether the student is currently in an active ACRE recovery
 *   loop by querying `recoveryState` on the progress document.
 * - Load the failed concept tags from the most recent recovery state.
 * - Identify which question IDs appeared in the student's last attempt so
 *   the sampler can apply a repeat-question penalty.
 *
 * ## What this class intentionally does NOT do
 * - It does not start or participate in database transactions.  The session
 *   it receives is always owned by the caller (AttemptService).
 * - It does not evaluate weights or perform question selection.
 * - It does not modify any database state.
 */
@injectable()
export class AdaptiveSelectionContextBuilder {
  constructor(
    @inject(USERS_TYPES.ProgressRepo)
    private readonly progressRepository: ProgressRepository,

    @inject(QUIZZES_TYPES.UserQuizMetricsRepo)
    private readonly userQuizMetricsRepository: UserQuizMetricsRepository,

    @inject(QUIZZES_TYPES.AttemptRepo)
    private readonly attemptRepository: AttemptRepository,
  ) {}

  /**
   * Assembles a {@link SelectionContext} for the given student and quiz.
   *
   * The method is intentionally fault-tolerant: any error during history
   * retrieval is caught and logged, and the returned context defaults to
   * non-adaptive mode (`recoveryActive: false`).  This ensures that a
   * transient database error during context loading never blocks the
   * student from starting a quiz — they will simply receive a random
   * question set instead of an adaptive one.
   *
   * @param userId - The student's user ID.
   * @param quizId - The quiz being attempted.
   * @param cohortId - Optional cohort the student belongs to; passed
   *   through to metrics queries that are cohort-scoped.
   * @param session - The MongoDB client session owned by the surrounding
   *   AttemptService transaction.  All reads participate in the same
   *   transaction to ensure a consistent snapshot.
   * @returns A fully populated SelectionContext.  When no active recovery
   *   state exists, `recoveryActive` is false and both tag and ID arrays
   *   are empty.
   */
  async buildContext(
    userId: string,
    quizId: string,
    cohortId?: string,
    session?: ClientSession,
  ): Promise<SelectionContext> {
    let recoveryActive = false;
    let failedTags: string[] = [];
    let previousQuestionIds: string[] = [];

    try {
      // A recovery state exists only when the student previously failed this
      // quiz and ACRE V1 redirected them to review content.  The query is
      // intentionally narrow: it matches only the exact quiz the student is
      // now retrying.
      const progress = await this.progressRepository.findActiveRecoveryProgress(
        userId,
        quizId,
        session,
      );

      if (progress?.recoveryState?.isActive) {
        recoveryActive = true;
        failedTags = (progress.recoveryState.failedTags ?? []).map(
          (tag: string) => tag.toLowerCase().trim(),
        );

        // Load the question IDs from the student's most recent attempt so
        // the sampler can penalise questions they have already seen.
        const metrics = await this.userQuizMetricsRepository.get(
          userId,
          quizId,
          cohortId,
          session,
        );

        if (metrics?.attempts?.length > 0) {
          const lastAttemptId =
            metrics.attempts[metrics.attempts.length - 1].attemptId.toString();

          const previousAttempt = await this.attemptRepository.getById(
            lastAttemptId,
            quizId,
            cohortId,
            session,
          );

          if (previousAttempt?.questionDetails) {
            previousQuestionIds = previousAttempt.questionDetails.map(
              (qd: any) => qd.questionId.toString(),
            );
          }
        }
      }
    } catch (err) {
      // A failure here means we cannot build an adaptive context, but we
      // must not block the attempt — fall back to random selection instead.
      console.error('[ACRE] Failed to load selection context; falling back to random selection:', err);
    }

    return {
      recoveryActive,
      failedTags,
      previousQuestionIds,
      userId,
      quizId,
    };
  }
}
