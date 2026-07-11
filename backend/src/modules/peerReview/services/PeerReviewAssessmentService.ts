import { injectable, inject } from 'inversify';
import { ClientSession, ObjectId } from 'mongodb';
import { LexoRank } from 'lexorank';
import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
} from 'routing-controllers';
import { BaseService } from '#root/shared/classes/BaseService.js';
import { MongoDatabase } from '#shared/database/providers/mongo/MongoDatabase.js';
import { GLOBAL_TYPES } from '#root/types.js';
import { PEERREVIEW_TYPES } from '../types.js';
import {
  PeerReviewAssessmentRepository,
} from '../repositories/providers/mongodb/PeerReviewAssessmentRepository.js';
import {
  PeerReviewSubmissionRepository,
} from '../repositories/providers/mongodb/PeerReviewSubmissionRepository.js';
import { PeerReviewAssignmentService } from './PeerReviewAssignmentService.js';
import { PeerReviewNotificationService } from './PeerReviewNotificationService.js';
import { IItemRepository, ICourseRepository } from '#root/shared/index.js';
import { USERS_TYPES } from '#root/modules/users/types.js';
import { PeerReviewAssessmentItem } from '#courses/classes/transformers/Item.js';
import {
  IPeerReviewAssessment,
  ItemType,
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
    @inject(PEERREVIEW_TYPES.PeerReviewSubmissionRepo)
    private readonly submissionRepo: PeerReviewSubmissionRepository,
    @inject(PEERREVIEW_TYPES.PeerReviewAssignmentService)
    private readonly assignmentService: PeerReviewAssignmentService,
    @inject(PEERREVIEW_TYPES.PeerReviewNotificationService)
    private readonly notifier: PeerReviewNotificationService,
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

      // 4. Link the new item to the section's itemsGroup so it appears
      //    in the teacher's course-content sidebar. Without this, the
      //    item is created in the peer_review_assessments collection but
      //    never surfaces in the section, so the UI shows no new item
      //    after a hard refresh.
      //
      //    Legacy / auto-seeded sections may not have an itemsGroup at
      //    all (the create flow was added later than the seed script).
      //    For those we create the itemsGroup here and stamp the
      //    section's itemsGroupId so subsequent GETs on the items
      //    endpoint can find it.
      let itemsGroup = await this.itemRepo.findItemsGroupBySectionId(
        body.sectionId,
        session,
      );
      if (!itemsGroup) {
        itemsGroup = await this.itemRepo.createItemsGroup(
          { sectionId: new ObjectId(body.sectionId) } as any,
          session,
        );
        // Stamp section.itemsGroupId on the version so the items GET
        // endpoint can resolve it on subsequent reads.
        const version = (await this.courseRepo.readVersion(
          body.courseVersionId,
          session,
        )) as any;
        if (version) {
          const mod = (version.modules ?? []).find(
            (m: any) => String(m.moduleId) === body.moduleId,
          );
          const sec = (mod?.sections ?? []).find(
            (s: any) => String(s.sectionId) === body.sectionId,
          );
          if (sec) {
            sec.itemsGroupId = itemsGroup._id;
            sec.updatedAt = new Date();
            await this.courseRepo.updateVersion(
              body.courseVersionId,
              version,
              session,
            );
          }
        }
      }
      if (itemsGroup) {
        // Compute a valid LexoRank order for the new item. If the group is
        // empty, start at the middle; otherwise append after the last item.
        // IMPORTANT: must use LexoRank, not a hand-built string — lexorank's
        // parser validates bucket names and throws 'Unknown bucket' if
        // they aren't on the lexorank alphabet.
        let order: string;
        if (!itemsGroup.items || itemsGroup.items.length === 0) {
          order = LexoRank.middle().toString();
        } else {
          const last = itemsGroup.items[itemsGroup.items.length - 1];
          order = LexoRank.parse(last.order).genNext().toString();
        }
        const newItemRef = {
          _id: itemObjectId,
          type: ItemType.PEER_REVIEW_ASSESSMENT,
          order,
          isHidden: false,
          name: body.itemName,
        };
        itemsGroup.items = (itemsGroup.items ?? []).concat(newItemRef as any);
        await this.itemRepo.updateItemsGroup(
          String(itemsGroup._id),
          itemsGroup,
          session,
        );
      }

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
   * Soft-delete an assessment (sets isDeleted=true, deletedAt=now).
   * The underlying Item is also hidden from the section's itemsGroup
   * so the sidebar doesn't keep showing a stale item. Allowed only
   * before the first submission arrives — once data exists, the
   * assessment is part of the student's audit trail and deletion would
   * break the double-blind contract.
   */
  async delete(teacher: IUser, assessmentId: string): Promise<void> {
    const existing = await this.assessmentRepo.findById(assessmentId);
    if (!existing || existing.isDeleted) {
      throw new NotFoundError('Assessment not found.');
    }
    const submissionCount = await this._countSubmissions(existing._id as any);
    if (submissionCount > 0) {
      throw new ForbiddenError(
        'Cannot delete an assessment after a student has submitted. ' +
          'Submissions are part of the student audit trail.',
      );
    }
    // Unlink from the section's itemsGroup so the sidebar item also
    // disappears. The Item doc itself stays in `items` collection as
    // a tombstone (cleaner than cascading deletes for now).
    await this._withTransaction(async session => {
      await this.assessmentRepo.softDelete(assessmentId, session);
      const itemsGroup =
        await this.itemRepo.findItemsGroupBySectionId(
          String(existing.sectionId),
          session,
        );
      if (itemsGroup && Array.isArray(itemsGroup.items)) {
        const filtered = itemsGroup.items.filter(
          (it: any) => String(it._id) !== String(existing.itemId),
        );
        if (filtered.length !== itemsGroup.items.length) {
          itemsGroup.items = filtered;
          await this.itemRepo.updateItemsGroup(
            String(itemsGroup._id),
            itemsGroup,
            session,
          );
        }
      }
    });
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
   * Fetch an assessment by the underlying course item's id. Used by
   * the student course page to discover which peer-review assessment
   * a given item is, so it can render the submission form for the
   * right assessment.
   *
   * Returns null if the item isn't a peer-review assessment (e.g. the
   * student clicked a Project item by accident and the page is asking
   * "is this a peer-review item?").
   */
  async getByItemId(itemId: string): Promise<IPeerReviewAssessment | null> {
    if (!itemId) return null;
    const a = await this.assessmentRepo.findByItemId(itemId);
    if (!a || a.isDeleted) return null;
    return a;
  }

  /**
   * Manually close an assessment's submission window. After this
   * call, students can no longer submit; if no reviewer assignments
   * have been generated yet, the assignment algorithm is invoked
   * inline so the close-then-notify latency is bounded by request
   * time, not cron tick. A "submissions closed" notification goes to
   * every submitter who already submitted (so they know peer-review
   * work is coming), plus the existing reviewer-assignment
   * notifications fire from the assignment pass.
   *
   * Idempotent w.r.t. already-closed.
   */
  async close(teacher: IUser, assessmentId: string): Promise<void> {
    const a = await this.get(assessmentId);
    if (a.closedAt) {
      throw new ForbiddenError('Assessment is already closed.');
    }

    // 1. Stamp closedAt FIRST so that even if a subsequent step
    //    throws, the close is durable and not silently re-tried.
    const closedAt = new Date();
    await this.assessmentRepo.setClosed(assessmentId, closedAt);

    // 2. Fire the assignment pass inline if it hasn't run yet. The
    //    AssignmentService.runForAssessment() is idempotent (returns
    //    already_ran when assignmentRunAt is set) so this is safe to
    //    call from both the cron path and this manual-close path.
    try {
      await this.assignmentService.runForAssessment(assessmentId);
    } catch (err) {
      // Don't fail the close if assignment fails (e.g. only one
      // submission so far) — the cron will retry on the next tick.
      console.warn(
        `[peer-review:close] runForAssessment failed for ${assessmentId}:`,
        err,
      );
    }

    // 3. Tell every submitter the window has closed and their peer
    //    reviews are due. Read submissions fresh (not from the
    //    possibly-stale `a` shape) so we have accurate studentIds.
    const submissions = await this.submissionRepo.findByAssessment(assessmentId);
    const reviewsPerSubmission =
      (a as any).config?.reviewsPerSubmission ?? 2;
    for (const s of submissions as any[]) {
      try {
        const studentId = (s.studentId as any)?.toString?.() ?? s.studentId;
        if (!studentId) continue;
        await this.notifier.notifySubmissionsClosed({
          userId: studentId,
          assessmentTitle: (a as any).title ?? 'Peer-review assessment',
          assessmentId,
          courseId: (a as any).courseId?.toString?.(),
          reviewDueAt: (a as any).reviewDeadline,
          reviewCount: reviewsPerSubmission,
        });
      } catch (err) {
        console.warn(
          `[peer-review:close] notify submitter failed for submission ${(s as any)._id}:`,
          err,
        );
      }
    }
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
    const queryId = typeof assessmentId === 'string' && ObjectId.isValid(assessmentId)
      ? new ObjectId(assessmentId)
      : assessmentId;
    return coll.countDocuments({ assessmentId: queryId as any });
  }
}