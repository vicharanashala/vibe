import { injectable, inject } from 'inversify';
import { ClientSession, ObjectId } from 'mongodb';
import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
} from 'routing-controllers';
import { BaseService } from '#root/shared/classes/BaseService.js';
import { MongoDatabase } from '#shared/database/providers/mongo/MongoDatabase.js';
import { GLOBAL_TYPES } from '#root/types.js';
import { PEERREVIEW_TYPES } from '../types.js';
import { PeerReviewAssessmentRepository } from '../repositories/providers/mongodb/PeerReviewAssessmentRepository.js';
import { IItemRepository, ICourseRepository } from '#root/shared/index.js';
import { USERS_TYPES } from '#root/modules/users/types.js';
import { PeerReviewAssessmentItem } from '#courses/classes/transformers/Item.js';
import {
  IPeerReviewAssessment,
  PeerReviewAntiCollusionMode,
  PeerReviewLatePolicy,
} from '#shared/interfaces/models.js';
import { IUser } from '#shared/interfaces/models.js';
import {
  CreatePeerReviewAssessmentBody,
  UpdatePeerReviewAssessmentBody,
  RubricCriterionDto,
  InstructorAttachmentDto,
} from '../classes/validators/PeerReviewValidators.js';

/**
 * Service layer for the peer-review assessment item type.
 *
 * Phase 2 responsibilities:
 *   - validate the create/edit body (rubric, deadlines, config)
 *   - create the assessment doc + the underlying Item record atomically
 *     (in a Mongo transaction)
 *   - update until first submission; close after review deadline
 *
 * The service intentionally avoids the heavier item-tree plumbing
 * (Module/Section reordering) because the calling controller layer
 * already does the item-tree rebalancing; we just need to insert the
 * right shape.
 */
@injectable()
export class PeerReviewAssessmentService extends BaseService {
  constructor(
    @inject(PEERREVIEW_TYPES.PeerReviewAssessmentRepo)
    private readonly assessmentRepo: PeerReviewAssessmentRepository,
    @inject(GLOBAL_TYPES.CourseRepo)
    private readonly courseRepo: ICourseRepository,
    @inject(USERS_TYPES.ItemRepo)
    private readonly itemRepo: IItemRepository,
    @inject(GLOBAL_TYPES.Database)
    private readonly database: MongoDatabase,
  ) {
    super(database);
  }

  /**
   * Create a peer-review assessment: persists both the full assessment
   * doc (rubric, deadlines, config) and the matching Item in the
   * section's ItemsGroup, atomically. Returns both ids.
   */
  async create(
    teacher: IUser,
    body: CreatePeerReviewAssessmentBody,
  ): Promise<{ assessmentId: string; itemId: string }> {
    // ---- input validation that the class-validator decorators can't do ----
    if (body.reviewsPerSubmission !== body.reviewsPerReviewer) {
      throw new BadRequestError(
        'reviewsPerSubmission must equal reviewsPerReviewer (symmetric load).',
      );
    }
    const totalMax = body.rubric.reduce(
      (acc: number, c: RubricCriterionDto) => acc + c.maxPoints,
      0,
    );
    if (totalMax <= 0) {
      throw new BadRequestError('Rubric total points must be > 0.');
    }
    const submissionDeadline = new Date(body.submissionDeadline);
    const reviewDeadline = new Date(
      submissionDeadline.getTime() +
        body.reviewWindowDays * 24 * 60 * 60 * 1000,
    );
    if (submissionDeadline <= new Date()) {
      throw new BadRequestError(
        'submissionDeadline must be in the future.',
      );
    }
    if (reviewDeadline <= submissionDeadline) {
      throw new BadRequestError(
        'reviewDeadline must be after submissionDeadline.',
      );
    }

    // ---- version / module / section / cohort chain validation ----
    await this._verifyChain(
      body.courseId,
      body.courseVersionId,
      body.moduleId,
      body.sectionId,
    );

    return this._withTransaction(async (session: ClientSession) => {
      // 1. Build a fresh ObjectId for the new item; we'll persist both the
      //    Item record and the assessment doc inside the transaction.
      const itemObjectId = new ObjectId();

      // 2. Create the Item record directly via the repository. The
      //    PeerReviewAssessmentItem constructor mirrors ProjectItem's
      //    signature; the details blob is filled in lazily on first read
      //    (see Phase 2 doc note about lazy-fill).
      const itemRecord = new PeerReviewAssessmentItem(
        body.itemName,
        body.itemDescription,
        itemObjectId,
        undefined, // details — stamped after we have the assessmentId
        body.reviewWindowDays > 0 ? true : false, // isOptional default
      );
      // Mark isHidden=false; teacher controls that separately.
      itemRecord.isHidden = false;

      const createdItem = await this.itemRepo.createItem(
        itemRecord as any,
        session,
      );
      if (!createdItem) {
        throw new BadRequestError('Failed to create item record.');
      }
      const itemId = itemObjectId.toString();

      // 3. Build the assessment doc.
      const assessment: IPeerReviewAssessment = {
        courseId: new ObjectId(body.courseId) as any,
        courseVersionId: new ObjectId(body.courseVersionId) as any,
        moduleId: new ObjectId(body.moduleId) as any,
        sectionId: new ObjectId(body.sectionId) as any,
        itemId: new ObjectId(itemId) as any,
        title: body.title,
        description: body.description,
        instructorAttachments: (body.instructorAttachments ?? []).map(
          (a: InstructorAttachmentDto) => ({
            name: a.name,
            url: a.url,
            kind: a.kind,
          }),
        ),
        rubric: body.rubric.map((c: RubricCriterionDto, idx: number) => ({
          criterionId: new ObjectId().toString(),
          label: c.label,
          description: c.description,
          maxPoints: c.maxPoints,
        })),
        totalMaxPoints: totalMax,
        submissionDeadline,
        reviewDeadline,
        config: {
          reviewsPerSubmission: body.reviewsPerSubmission,
          reviewsPerReviewer: body.reviewsPerReviewer,
          antiCollusionMode: body.antiCollusionMode as PeerReviewAntiCollusionMode,
          latePolicy: body.latePolicy as PeerReviewLatePolicy,
          latePenaltyPercent: body.latePenaltyPercent,
          teacherManualReviewEnabled: body.teacherManualReviewEnabled,
          notificationsEnabled: body.notificationsEnabled,
          reviewWindowDays: body.reviewWindowDays,
        },
        cohortId: new ObjectId(body.cohortId) as any,
        createdBy: new ObjectId(teacher._id!.toString()) as any,
        createdAt: new Date(),
        updatedAt: new Date(),
        isDeleted: false,
      };

      const assessmentId = await this.assessmentRepo.create(
        assessment,
        session,
      );

      // 4. Stamp the item's `details` blob with the freshly-created
      //    assessmentId so the student/teacher renderers can look up
      //    the full assessment via the item record. Without this, the
      //    ItemContainer's PeerReviewItemBody hits `useGetPeerReviewAssessment(undefined)`
      //    and silently renders the "not linked to an item" empty state.
      const itemDetails = {
        assessmentId,
        totalMaxPoints: totalMax,
        submissionDeadline: submissionDeadline.toISOString(),
        reviewDeadline: reviewDeadline.toISOString(),
        rubricSummary: assessment.rubric.map((r) => ({
          criterionId: r.criterionId,
          label: r.label,
          maxPoints: r.maxPoints,
        })),
      };
      await this.itemRepo.updatePeerReviewItemDetails(
        itemObjectId.toString(),
        itemDetails,
        session,
      );

      return { assessmentId, itemId };
    });
  }

  /**
   * Edit an existing assessment. Only allowed before the first submission
   * arrives.
   */
  async edit(
    teacher: IUser,
    assessmentId: string,
    patch: UpdatePeerReviewAssessmentBody,
  ): Promise<void> {
    const existing = await this.assessmentRepo.findById(assessmentId);
    if (!existing || existing.isDeleted) {
      throw new NotFoundError('Assessment not found.');
    }
    if (existing.submissionDeadline <= new Date()) {
      throw new ForbiddenError(
        'Cannot edit an assessment after the submission deadline has passed.',
      );
    }
    const submissionCount = await this._countSubmissions(existing._id as any);
    if (submissionCount > 0) {
      throw new ForbiddenError(
        'Cannot edit an assessment after a student has submitted (use a new assessment instead).',
      );
    }

    const merged: Partial<IPeerReviewAssessment> = {};
    if (patch.title !== undefined) merged.title = patch.title;
    if (patch.description !== undefined) merged.description = patch.description;
    if (patch.instructorAttachments !== undefined) {
      merged.instructorAttachments = patch.instructorAttachments.map(a => ({
        name: a.name,
        url: a.url,
        kind: a.kind,
      }));
    }
    if (patch.rubric !== undefined) {
      const totalMax = patch.rubric.reduce((acc, c) => acc + c.maxPoints, 0);
      if (totalMax <= 0) {
        throw new BadRequestError('Rubric total points must be > 0.');
      }
      merged.rubric = patch.rubric.map(c => ({
        criterionId: new ObjectId().toString(),
        label: c.label,
        description: c.description,
        maxPoints: c.maxPoints,
      }));
      merged.totalMaxPoints = totalMax;
    }
    if (patch.submissionDeadline !== undefined) {
      const sub = new Date(patch.submissionDeadline);
      const win = patch.reviewWindowDays ?? existing.config.reviewWindowDays;
      const rev = new Date(sub.getTime() + win * 24 * 60 * 60 * 1000);
      merged.submissionDeadline = sub;
      merged.reviewDeadline = rev;
    }
    if (patch.latePolicy !== undefined) {
      merged.config = { ...existing.config, latePolicy: patch.latePolicy as PeerReviewLatePolicy };
    }
    if (patch.latePenaltyPercent !== undefined) {
      merged.config = {
        ...(merged.config ?? existing.config),
        latePenaltyPercent: patch.latePenaltyPercent,
      };
    }
    if (patch.teacherManualReviewEnabled !== undefined) {
      merged.config = {
        ...(merged.config ?? existing.config),
        teacherManualReviewEnabled: patch.teacherManualReviewEnabled,
      };
    }
    if (patch.notificationsEnabled !== undefined) {
      merged.config = {
        ...(merged.config ?? existing.config),
        notificationsEnabled: patch.notificationsEnabled,
      };
    }

    await this.assessmentRepo.update(assessmentId, merged);
  }

  /**
   * Fetch an assessment by id. Authorization is performed at the
   * controller layer; the service is a thin pass-through.
   */
  async get(assessmentId: string): Promise<IPeerReviewAssessment> {
    const a = await this.assessmentRepo.findById(assessmentId);
    if (!a || a.isDeleted) {
      throw new NotFoundError('Assessment not found.');
    }
    return a;
  }

  /**
   * Manually close an assessment (e.g. teacher wants to finalize scores
   * before the review deadline has elapsed). Phase 5's
   * FinalizationRunner cron also calls this on its own timer.
   *
   * For Phase 2 this is a no-op that stamps `closedAt`; the real
   * finalization (compute finalScores, fire notifications) is wired up
   * in Phase 5.
   */
  async close(teacher: IUser, assessmentId: string): Promise<void> {
    const a = await this.get(assessmentId);
    if (a.closedAt) {
      throw new ForbiddenError('Assessment is already closed.');
    }
    await this.assessmentRepo.setClosed(assessmentId, new Date());
  }

  // ---- private helpers ----

  private async _verifyChain(
    courseId: string,
    versionId: string,
    moduleId: string,
    sectionId: string,
    session?: ClientSession,
  ): Promise<void> {
    const version = (await this.courseRepo.readVersion(
      versionId,
      session,
    )) as any;
    if (!version) {
      throw new NotFoundError(`Course version ${versionId} not found.`);
    }
    if (String(version.courseId) !== courseId) {
      throw new BadRequestError(
        'courseId does not match the given courseVersionId.',
      );
    }
    const mod = (version.modules ?? []).find(
      (m: any) => String(m.moduleId) === moduleId,
    );
    if (!mod) {
      throw new NotFoundError(
        `Module ${moduleId} not found in version ${versionId}.`,
      );
    }
    const sec = (mod.sections ?? []).find(
      (s: any) => String(s.sectionId) === sectionId,
    );
    if (!sec) {
      throw new NotFoundError(
        `Section ${sectionId} not found in module ${moduleId}.`,
      );
    }
  }

  /**
   * Submission count check, used by edit() to enforce the "no edits after
   * a student has submitted" rule. We resolve the repo dynamically to
   * avoid a circular import with peerReview's submission repository.
   */
  private async _countSubmissions(assessmentId: any): Promise<number> {
    const { PEERREVIEW_TYPES } = await import('../types.js');
    const { PeerReviewSubmissionRepository } = await import(
      '../repositories/providers/mongodb/PeerReviewSubmissionRepository.js'
    );
    const repo = this.database
      ? (globalThis as any).peerReviewSubmissionRepo
      : null;
    // Direct collection query to avoid a DI reshape this phase.
    const coll = await this.database.getCollection('peer_review_submissions');
    void repo;
    void PEERREVIEW_TYPES;
    void PeerReviewSubmissionRepository;
    return coll.countDocuments({ assessmentId: assessmentId as any });
  }
}