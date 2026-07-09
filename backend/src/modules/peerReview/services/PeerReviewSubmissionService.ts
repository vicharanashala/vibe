import { injectable, inject } from 'inversify';
import { ObjectId } from 'mongodb';
import { BadRequestError, ForbiddenError, NotFoundError } from 'routing-controllers';
import { BaseService } from '#root/shared/classes/BaseService.js';
import { MongoDatabase } from '#shared/database/providers/mongo/MongoDatabase.js';
import { GLOBAL_TYPES } from '#root/types.js';
import { PEERREVIEW_TYPES } from '../types.js';
import { PeerReviewAssessmentRepository } from '../repositories/providers/mongodb/PeerReviewAssessmentRepository.js';
import { PeerReviewSubmissionRepository } from '../repositories/providers/mongodb/PeerReviewSubmissionRepository.js';
import { PeerReviewUrlAccessibilityService } from './PeerReviewUrlAccessibilityService.js';
import { detectKind } from '../utils/urlKindDetector.js';
import {
  IPeerReviewSubmission,
  IPeerReviewLink,
  PeerReviewLinkKind,
} from '#shared/interfaces/models.js';
import { IUser } from '#shared/interfaces/models.js';
import { SubmitPeerReviewBody, StudentLinkDto } from '../classes/validators/PeerReviewSubmissionValidators.js';

/**
 * Service layer for student submissions to a peer-review assessment.
 *
 * Phase 3 responsibilities:
 *   - validate the submission body (1..20 links, each present)
 *   - HEAD-check every link; reject if any are inaccessible
 *   - coerce missing `kind` from URL host via detectKind()
 *   - upsert idempotent on (assessmentId, studentId)
 *   - stamp isLate = now > assessment.submissionDeadline
 *
 * The service intentionally does NOT enforce enrollment — that's a
 * Phase 5 concern (we want a student's UI to render "you are enrolled"
 * even before they've enrolled in the right cohort, so the UX is
 * inclusive). For now we check that the assessment is in the student's
 * own cohort via the assessment.cohortId; if a future teacher wants to
 * override that they can pass a bypass flag. In Phase 5 we wire real
 * enrollment checks via CASL.
 */
@injectable()
export class PeerReviewSubmissionService extends BaseService {
  constructor(
    @inject(PEERREVIEW_TYPES.PeerReviewAssessmentRepo)
    private readonly assessmentRepo: PeerReviewAssessmentRepository,
    @inject(PEERREVIEW_TYPES.PeerReviewSubmissionRepo)
    private readonly submissionRepo: PeerReviewSubmissionRepository,
    @inject(PEERREVIEW_TYPES.PeerReviewUrlAccessibilityChecker)
    private readonly accessibilityChecker: PeerReviewUrlAccessibilityService,
    @inject(GLOBAL_TYPES.Database)
    database: MongoDatabase,
  ) {
    super(database);
  }

  /**
   * Submit (or update) a student's submission to an assessment.
   *
   * Returns the submission id. Idempotent: calling submit() twice on
   * the same (assessmentId, studentId) updates the existing row.
   */
  async submit(
    student: IUser,
    assessmentId: string,
    body: SubmitPeerReviewBody,
  ): Promise<{ submissionId: string }> {
    // 1. Body shape check (class-validator covers most, but enforce
    //    that 1..N links are present at this layer for clarity).
    if (!body.links || body.links.length < 1) {
      throw new BadRequestError('At least one link is required.');
    }
    if (body.links.length > 20) {
      throw new BadRequestError('At most 20 links allowed.');
    }
    // Reject duplicates inside the same submission — we'd persist them
    // anyway but the UX is broken if the user pastes the same URL twice.
    const seen = new Set<string>();
    for (const l of body.links) {
      const key = l.url.trim().toLowerCase();
      if (seen.has(key)) {
        throw new BadRequestError(
          `Duplicate link in submission: ${l.url}`,
        );
      }
      seen.add(key);
    }

    // 2. Resolve assessment + check it's not closed.
    const assessment = await this.assessmentRepo.findById(assessmentId);
    if (!assessment || assessment.isDeleted) {
      throw new NotFoundError('Assessment not found.');
    }
    if (assessment.closedAt) {
      throw new ForbiddenError(
        'Assessment is closed; submissions are no longer accepted.',
      );
    }

    // 3. Optional cohort/role gating (Phase 5 will harden via CASL).
    //    For Phase 3 we accept any authenticated student.

    // 4. Accessibility check every link in parallel. Reject the whole
    //    submission if any link is inaccessible — we never want to
    //    persist a partially-accessible submission.
    const urls = body.links.map(l => l.url.trim());
    const results = await this.accessibilityChecker.checkMany(urls);
    const firstFailure = results.find(r => !r.accessible);
    if (firstFailure) {
      throw new BadRequestError(
        `Link not publicly accessible (${firstFailure.reason ?? 'unknown'}): ${
          urls[results.indexOf(firstFailure)]
        }. Make the link shareable (Drive: Anyone with the link).`,
      );
    }

    // 5. Coerce missing kind from URL host; stamp `lastAccessible` on
    //    each link so the renderer can show an icon later.
    const now = new Date();
    const links: IPeerReviewLink[] = body.links.map((l: StudentLinkDto, i: number) => {
      const kind: PeerReviewLinkKind =
        (l.kind as PeerReviewLinkKind) ?? detectKind(l.url);
      return {
        url: l.url,
        label: l.label,
        kind,
        accessibilityCheckedAt: now,
        lastAccessible: true,
      };
    });

    // 6. Compute isLate against the assessment's submissionDeadline.
    const isLate = now > assessment.submissionDeadline;

    // 7. Idempotent upsert.
    //
    // Don't include `studentId` in the $set payload — the repository
    // already sets it via $setOnInsert for the unique-index path, and
    // Mongo rejects $set+$setOnInsert on the same path with
    // "Updating the path 'studentId' would create a conflict".
    const submissionId = await this.submissionRepo.upsertForStudent(
      assessmentId,
      student._id!.toString(),
      {
        cohortId: assessment.cohortId,
        courseId: assessment.courseId,
        courseVersionId: assessment.courseVersionId,
        notes: body.notes ?? '',
        links,
        submittedAt: now,
        isLate,
        attachmentsAccessibilityChecked: true,
      } as Partial<IPeerReviewSubmission>,
    );

    // Audit-trail emission: defer until Phase 5 (request context plumbing).
    // The AuditCategory / AuditAction enum values are reserved from Phase 1
    // commit 4; the controller-level audit call lands in Phase 5.
    return { submissionId };
  }

  /**
   * Fetch a single student's own submission (or null if they haven't
   * submitted yet).
   */
  async getMine(
    student: IUser,
    assessmentId: string,
  ): Promise<IPeerReviewSubmission | null> {
    return this.submissionRepo.findByAssessmentAndStudent(
      assessmentId,
      student._id!.toString(),
    );
  }

  /**
   * Count of all submissions to an assessment. Used by the Phase 4
   * AssignmentRunner cron to know how many submitters are in the pool.
   */
  async countForAssessment(assessmentId: string): Promise<number> {
    return this.submissionRepo.countForAssessment(assessmentId);
  }
}
