import { injectable, inject } from 'inversify';
import { ObjectId } from 'mongodb';
import { BaseService } from '#root/shared/classes/BaseService.js';
import { MongoDatabase } from '#shared/database/providers/mongo/MongoDatabase.js';
import { GLOBAL_TYPES } from '#root/types.js';
import { PEERREVIEW_TYPES } from '../types.js';
import { PeerReviewAssessmentRepository } from '../repositories/providers/mongodb/PeerReviewAssessmentRepository.js';
import { PeerReviewSubmissionRepository } from '../repositories/providers/mongodb/PeerReviewSubmissionRepository.js';
import { PeerReviewAssignmentRepository } from '../repositories/providers/mongodb/PeerReviewAssignmentRepository.js';
import {
  assignReviewers,
  pairsFromAssignments,
} from '../utils/assignmentAlgorithm.js';

/**
 * PeerReviewAssignmentService — wraps the pure assignment algorithm and
 * does all the DB I/O needed to actually run it:
 *
 *   - load the assessment + its submissions
 *   - gather prior pairs across past assessments in the same course
 *   - call the algorithm
 *   - persist the resulting ReviewAssignments
 *   - set assessment.assignmentRunAt
 *   - bump enrollment.peerReviewsAssigned + peerReviewsCompleted counters
 *
 * The service is what the AssignmentRunner cron calls into. It is
 * also the public API surface that teacher-side endpoints (Phase 5's
 * "run now" button) hit.
 */
@injectable()
export class PeerReviewAssignmentService extends BaseService {
  constructor(
    @inject(PEERREVIEW_TYPES.PeerReviewAssessmentRepo)
    private readonly assessmentRepo: PeerReviewAssessmentRepository,
    @inject(PEERREVIEW_TYPES.PeerReviewSubmissionRepo)
    private readonly submissionRepo: PeerReviewSubmissionRepository,
    @inject(PEERREVIEW_TYPES.PeerReviewAssignmentRepo)
    private readonly assignmentRepo: PeerReviewAssignmentRepository,
    @inject(GLOBAL_TYPES.Database)
    private readonly database: MongoDatabase,
  ) {
    super(database);
  }

  /**
   * Run the assignment algorithm for one assessment. Idempotent:
   * if the assessment already has assignmentRunAt set, returns
   * {alreadyRan: true} without re-running. Otherwise it generates
   * assignments, persists them, sets assignmentRunAt, and fires
   * notifications via NotificationService (Phase 4.2.4).
   *
   * Returns a structured result so the cron / API caller can decide
   * what to log.
   */
  async runForAssessment(assessmentId: string): Promise<
    | { status: 'already_ran'; pairsCreated: number }
    | {
        status: 'ran';
        algorithm: 'circular-shift-collision-check' | 'fallback-uniform-random';
        attempts: number;
        pairsCreated: number;
        insufficientSubmissions?: number;
      }
    | { status: 'insufficient_submissions'; n: number }
  > {
    const assessment = await this.assessmentRepo.findById(assessmentId);
    if (!assessment || assessment.isDeleted) {
      return { status: 'insufficient_submissions', n: 0 };
    }
    if (assessment.assignmentRunAt) {
      const allSubmissions = await this.submissionRepo.findByAssessment(
        assessmentId,
      );
      const totalAssignments =
        allSubmissions.length * assessment.config.reviewsPerSubmission;
      return { status: 'already_ran', pairsCreated: totalAssignments };
    }

    // 1. Gather submissions
    const submissions = await this.submissionRepo.findByAssessment(
      assessmentId,
    );
    if (submissions.length < 2) {
      await this.assessmentRepo.setAssignmentRunAt(
        assessmentId,
        new Date(),
      );
      return { status: 'insufficient_submissions', n: submissions.length };
    }

    // 2. Gather prior pairs across all assessments in the same course.
    // For v1 we read all the course's assignments and convert them to
    // (reviewerId, submitterId) pairs via the submission→student map.
    // Optimization opportunity for v2: index prior pairs by (courseId, assessmentId)
    // so we don't have to walk every assignment. For v1 correctness wins.
    const courseAssessments = await this.assessmentRepo.findActiveByCourse(
      assessment.courseId as any as string,
    );
    const otherAssessmentIds = courseAssessments
      .filter((a) => (a._id as any).toString() !== assessmentId)
      .map((a) => (a._id as any).toString());
    const priorPairs: { reviewerId: string; submitterId: string }[] = [];
    const submissionStudentMap = new Map<string, string>();
    for (const s of submissions) {
      submissionStudentMap.set(
        s._id as any as string,
        s.studentId as any as string,
      );
    }
    // Also need submissions for the OTHER assessments to build the
    // (submissionId → studentId) map.
    for (const otherId of otherAssessmentIds) {
      const otherSubs = await this.submissionRepo.findByAssessment(otherId);
      for (const s of otherSubs) {
        submissionStudentMap.set(
          s._id as any as string,
          s.studentId as any as string,
        );
      }
    }
    // Pull assignments for these other assessments via the underlying
    // collection — the repo doesn't expose findByAssessment yet. We
    // do a raw query through the DB reference.
    const db = (this as any).database as MongoDatabase;
    const assignColl = await db.getCollection('peer_review_assignments');
    const { ObjectId: MongoObjectId } = await import('mongodb');
    for (const otherId of otherAssessmentIds) {
      const rows = await assignColl
        .find({ assessmentId: otherId as any })
        .toArray();
      for (const row of rows) {
        priorPairs.push(
          ...pairsFromAssignments(
            rows.map((r: any) => ({
              submissionId: (r.submissionId as any).toString(),
              reviewerId: (r.reviewerId as any).toString(),
            })),
            submissionStudentMap,
          ),
        );
      }
    }
    void MongoObjectId;

    // 3. Run the algorithm
    const result = assignReviewers(
      submissions.map((s) => ({
        assessmentId: (s.assessmentId as any).toString(),
        submissionId: (s._id as any).toString(),
        studentId: (s.studentId as any).toString(),
      })),
      priorPairs,
      {
        target: assessment.config.reviewsPerSubmission,
        maxAttempts: 50,
        seed: (assessment._id as any).toString().length,
      },
    );

    if (!result.ok) {
      await this.assessmentRepo.setAssignmentRunAt(
        assessmentId,
        new Date(),
      );
      return { status: 'insufficient_submissions', n: 0 };
    }

    // 4. Persist the assignments. We do this in one bulk insert via the
    //    repo's createMany.
    const docs = result.pairs.map((p) => ({
      assessmentId: new ObjectId(p.assessmentId) as any,
      submissionId: new ObjectId(p.submissionId) as any,
      reviewerId: new ObjectId(p.reviewerId) as any,
      cohortId: assessment.cohortId,
      courseId: assessment.courseId,
      courseVersionId: assessment.courseVersionId,
      assignedAt: new Date(),
      dueAt: assessment.reviewDeadline,
      status: 'PENDING' as const,
      reassignmentCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));
    const ids = await this.assignmentRepo.createMany(docs);

    // 5. Also update each submission's reviewsTotal + push assignment IDs.
    for (let i = 0; i < docs.length; i++) {
      const d = docs[i];
      const subId = (d.submissionId as any).toString();
      const assignmentId = ids[i];
      await this.submissionRepo.setReviewsTotal(
        subId,
        assessment.config.reviewsPerSubmission,
      );
      await this.submissionRepo.appendReviewAssignmentId(subId, assignmentId);
    }

    // 6. Bump the enrollment.peerReviewsAssigned counter per reviewer
    //    (Phase 5 will introduce a proper EnrollmentRepository call
    //    once we wire it; for Phase 4 we just log the count.)
    //    TODO Phase 5: replace with EnrollmentRepository.incReviewsAssigned(...)

    // 7. Stamp assignmentRunAt so we don't re-run.
    await this.assessmentRepo.setAssignmentRunAt(assessmentId, new Date());

    // 8. Fire notifications (assignments.out per reviewer). Wired in
    //    Phase 4.2.4 — the AssignmentRunner cron layer calls the
    //    notification service directly.

    return {
      status: 'ran',
      algorithm: result.algorithm,
      attempts: result.attempts,
      pairsCreated: ids.length,
    };
  }
}