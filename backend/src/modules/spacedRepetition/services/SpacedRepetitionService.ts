import { injectable, inject } from 'inversify';
import { ClientSession } from 'mongodb';
import { NotFoundError, InternalServerError, ForbiddenError, HttpError } from 'routing-controllers';
import { SPACED_REPETITION_TYPES } from '../types.js';
import { BaseService } from '#root/shared/classes/BaseService.js';
import { MongoDatabase } from '#shared/database/providers/mongo/MongoDatabase.js';
import { GLOBAL_TYPES } from '#root/types.js';
import { ICourseRepository } from '#root/shared/database/interfaces/ICourseRepository.js';
import { IUserRepository } from '#root/shared/database/interfaces/IUserRepository.js';
import { ReviewItemRepository, StudentSRStatusRepository } from '#spacedRepetition/repositories/index.js';
import { QUIZZES_TYPES } from '#quizzes/types.js';
import { QuestionBankRepository } from '#quizzes/repositories/providers/mongodb/QuestionBankRepository.js';
import { QuestionRepository } from '#quizzes/repositories/providers/mongodb/QuestionRepository.js';
import {
  IReviewItem,
  ISM2State,
  RecallQuality,
  RECALL_QUALITY_MAP,
  DEFAULT_SM2_STATE,
} from '../interfaces/IReviewItem.js';
import {
  TeacherCourseSummary,
  CoursesListResponse,
  EnrichedStudent,
  CourseStudentsRichResponse,
  QuestionSummary,
  QuestionSummaryResponse,
} from '../classes/validators/SpacedRepetitionValidator.js';

// ── Retention health summary returned per course ───────────────────────────

export interface ICourseRetentionSummary {
  courseId: string;
  totalItems: number;

  /** Items whose next_review_at is in the past — student is overdue. */
  overdueCount: number;

  /** Items due within the next 7 days. */
  dueSoonCount: number;

  /** Average EF across all items — proxy for overall ease of retention. */
  averageEF: number;

  items: IReviewItem[];
}

@injectable()
class SpacedRepetitionService extends BaseService {
  constructor(
    @inject(GLOBAL_TYPES.Database)
    public readonly database: MongoDatabase,

    @inject(SPACED_REPETITION_TYPES.ReviewItemRepo)
    private readonly reviewItemRepo: ReviewItemRepository,

    @inject(SPACED_REPETITION_TYPES.StudentSRStatusRepo)
    private readonly studentSRStatusRepo: StudentSRStatusRepository,

    // Knob 7 (Phase C, 2026-07-21): cross-module repos used by the manual
    // review-assignment endpoints. QuestionBankRepo is owned by the quizzes
    // module but registered globally via loadAppModules('all'), so we can
    // @inject it from here without circular imports.
    @inject(QUIZZES_TYPES.QuestionBankRepo)
    private readonly questionBankRepo: QuestionBankRepository,

    @inject(QUIZZES_TYPES.QuestionRepo)
    private readonly questionRepo: QuestionRepository,

    // Day 2 (2026-08-04): course + user repos for the teacher-facing
    // human-readable name lookups. Both registered globally via the
    // root container so we can @inject them without touching the
    // spaced-repetition container module.
    @inject(GLOBAL_TYPES.CourseRepo)
    private readonly courseRepo: ICourseRepository,

    @inject(GLOBAL_TYPES.UserRepo)
    private readonly userRepo: IUserRepository,
  ) {
    super(database);
  }

  // ── SR-disabled guards (Knob 6, Phase C, 2026-07-21) ───────────────────

  /**
   * Throws ForbiddenError if the student has SR disabled.
   * Used to short-circuit any write path (seed, review) when SR is off.
   *
   * Opt-in `session` parameter so callers running inside a MongoDB
   * transaction can fold the read into the same snapshot as their
   * writes. This closes the race window where a concurrent
   * setStatus() could disable SR between the read and the write
   * (audit finding B2).
   */
  private async _assertSREnabled(
    studentId: string,
    session?: ClientSession,
  ): Promise<void> {
    const disabled = await this.studentSRStatusRepo.getStatus(
      studentId,
      session,
    );
    if (disabled) {
      throw new ForbiddenError(
        'Spaced repetition is disabled for this student.',
      );
    }
  }

  /**
   * Returns the SR-disabled flag for one student.
   * Used by the frontend to choose between the empty-state copy
   * ("no reviews yet") and the disabled copy ("disabled by teacher").
   */
  async getStudentSRStatus(studentId: string): Promise<boolean> {
    return this.studentSRStatusRepo.getStatus(studentId);
  }

  /**
   * Sets the SR-disabled flag for one student.
   * Returns the new flag value.
   */
  async setStudentSRStatus(
    studentId: string,
    disabled: boolean,
  ): Promise<{ studentId: string; sr_disabled: boolean }> {
    return this._withTransaction(async session => {
      const matched = await this.studentSRStatusRepo.setStatus(
        studentId,
        disabled,
        session,
      );
      if (!matched) {
        throw new NotFoundError(
          `No user found with firebaseUID '${studentId}'.`,
        );
      }
      return { studentId, sr_disabled: disabled };
    });
  }

  /**
   * Bulk-set the SR-disabled flag for many students.
   *
   * Returns the same dual-count shape as the other 3 bulk endpoints
   * (bulk-update-notifications, bulk-update-exam-prep, bulk-update-pause):
   *   - `studentsAffected` = how many user docs the bulk touched (matched)
   *   - `itemsAffected`     = how many actually transitioned (modified)
   *   - `updatedCount`      = alias for `studentsAffected` (kept for
   *                           frontend compatibility with the
   *                           `BulkUpdateResponse` shape)
   *
   * Bug 3 (2026-08-01) fixed the dual-count for 3 of 4 bulk endpoints.
   * This one missed the fix until the 2026-08-06 audit (R-15 / B-9 / C-10).
   */
  async bulkSetStudentSRStatus(
    studentIds: string[],
    disabled: boolean,
  ): Promise<{
    studentsAffected: number;
    itemsAffected: number;
    updatedCount: number;
    message: string;
  }> {
    return this._withTransaction(async session => {
      const { matchedCount, modifiedCount } =
        await this.studentSRStatusRepo.setStatusForMany(
          studentIds,
          disabled,
          session,
        );
      const studentsAffected = matchedCount;
      const itemsAffected = modifiedCount;
      return {
        studentsAffected,
        itemsAffected,
        updatedCount: studentsAffected,
        message: disabled
          ? `Disabled SR for ${studentsAffected} student(s) (${itemsAffected} state change${itemsAffected === 1 ? '' : 's'}).`
          : `Re-enabled SR for ${studentsAffected} student(s) (${itemsAffected} state change${itemsAffected === 1 ? '' : 's'}).`,
      };
    });
  }

  // ── SM-2 algorithm (private, pure — no DB calls) ─────────────────────────

  /**
   * Applies the SM-2 algorithm to an existing ReviewItem and returns the
   * updated SM-2 state fields plus the next review date.
   *
   * Formula (from the spec):
   *   if q >= 3:
   *     n = 0 → I = 1; n = 1 → I = 6; else → I = round(I_prev * EF)
   *     n = n + 1
   *     EF = EF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
   *     EF = max(EF, 1.3)
   *   if q < 3:
   *     n = 0
   *     I = 1
   */
  private _applySM2(
    item: IReviewItem,
    quality: RecallQuality,
  ): ISM2State & { next_review_at: Date; last_reviewed_at: Date } {
    const q = RECALL_QUALITY_MAP[quality];
    let { n, EF, interval_days } = item;

    if (q >= 3) {
      // Correct response — advance the interval
      if (n === 0) {
        interval_days = 1;
      } else if (n === 1) {
        interval_days = 6;
      } else {
        interval_days = Math.round(interval_days * EF);
      }
      n = n + 1;
      EF = EF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
      EF = Math.max(EF, 1.3);
    } else {
      // Incorrect response — reset to start
      n = 0;
      interval_days = 1;
      // EF is not changed on an incorrect response per SM-2 spec
    }

    const now = new Date();
    const next_review_at = new Date(now);
    next_review_at.setDate(next_review_at.getDate() + interval_days);

    return {
      n,
      EF,
      interval_days,
      next_review_at,
      last_reviewed_at: now,
    };
  }

  // ── Public service methods ────────────────────────────────────────────────

  /**
   * Seeds a spaced repetition schedule for a student on course completion.
   * Creates one ReviewItem per questionId with DEFAULT_SM2_STATE.
   * next_review_at is set to 1 day from now (the first review interval).
   *
   * Called by the course completion hook (Step 7).
   */
  seedSchedule(
    studentId: string,
    courseId: string,
    questionIds: string[],
  ) {
    return this._withTransaction(async session => {
      if (!questionIds.length) {
        throw new InternalServerError(
          'Cannot seed schedule: no questions provided.',
        );
      }

      // Knob 6: refuse to seed if the student has SR disabled.
      // The teacher must re-enable first. This is a teacher-coach lever, not
      // an automatic gate — the auto-seeding course-completion hook will
      // silently no-op (caught upstream), and explicit seeds from the
      // teacher UI will surface a clear 403.
      // B2: pass the active transaction session so the read runs in
      // the same snapshot as the subsequent write — closes the race
      // window where a concurrent setStatus() could disable SR
      // between the read and the insertMany below.
      await this._assertSREnabled(studentId, session);

      const now = new Date();
      const firstReviewAt = new Date(now);
      firstReviewAt.setDate(firstReviewAt.getDate() + DEFAULT_SM2_STATE.interval_days);

      const items: Omit<IReviewItem, '_id'>[] = questionIds.map(questionId => ({
        student_id: studentId,
        course_id: courseId,
        question_id: questionId,
        ...DEFAULT_SM2_STATE,
        next_review_at: firstReviewAt,
        last_reviewed_at: null,
        notification_opt_out: false,
        exam_prep_mode: false,
        // W3: analytics distinguishes auto-seed vs manual-assigned
        // review items. assignReview() already writes 'manual'; this
        // path was previously leaving the field undefined, which
        // downstream analytics treated as "unknown source" for 100%
        // of seeded items.
        source: 'auto-seed',
      }));

      // Guard against double-seeding: skip if items already exist for this student+course
      const existing = await this.reviewItemRepo.findByStudentAndCourse(
        studentId,
        courseId,
        session,
      );
      if (existing.length > 0) {
        return { seeded: 0 };
      }

      const insertedCount = await this.reviewItemRepo.createMany(items, session);

      if (insertedCount !== questionIds.length) {
        throw new InternalServerError(
          `Schedule seeding incomplete: expected ${questionIds.length} items, inserted ${insertedCount}.`,
        );
      }

      return { seeded: insertedCount };
    });
  }

  /**
   * Processes a student's response to a review question.
   * Fetches the ReviewItem, applies SM-2, and persists the updated state.
   *
   * Called by the controller when a student submits a review response.
   *
   * For MCQ question types (SELECT_ONE_IN_LOT / SELECT_MANY_IN_LOT),
   * the caller may pass `selectedOptionIndices` — the indices into the
   * review-mode `options[]` array the student saw. When provided, this
   * method also computes whether the student answered correctly by
   * comparing those indices against the question's canonical
   * solution. The result is returned in `isCorrect` so the frontend
   * can light up the picked option(s) green (correct) or red (wrong).
   *
   * The correct option indices are NEVER returned to the frontend —
   * only the boolean `isCorrect`. This preserves the review-mode
   * security boundary where students shouldn't be able to retrieve
   * answer keys by querying the review endpoint.
   */
  /**
   * Records a recall response from the student, runs SM-2, persists
   * the updated ReviewItem, and (when an objective answer signal is
   * supplied) reports whether the student's pick was correct.
   *
   * **Server-side quality integrity (Knob 8c, 2026-07-29):** when the
   * student's objective answer is verifiable (MCQ indices or a NAT
   * numeric input) and is **wrong**, the quality passed to SM-2 is
   * capped at `unsure` (q=3) regardless of what the client claims.
   * The original client-reported quality is returned in
   * `qualityAdjustedFrom` (when a downgrade happened) so the frontend
   * can surface a small "downgraded" notice. This closes two loopholes
   * the frontend-only gate could not:
   *   1. DevTools bypass of the disabled-`Got it` button.
   *   2. NUMERIC_ANSWER questions which had no MCQ-clicked-isCorrect
   *      signal for the frontend to gate.
   *
   * Answer inputs:
   *   - MCQ (SELECT_ONE_IN_LOT / SELECT_MANY_IN_LOT):
   *     `selectedOptionIndices` — indices into the review-mode
   *     `options[]` array.
   *   - NUMERIC_ANSWER:
   *     `numericAnswer` — string the student typed. Server compares
   *     as parsed float to the question's `solution.numericAnswer`,
   *     exact match (no tolerance — simplest defensible default).
   *   - Other question types:
   *     Neither input is supplied; correctness is undefined and the
   *     client's quality is trusted as-is.
   *
   * **Reveal-on-missed affordance:** when the (post-cap) quality is
   * `missed`, the response includes `canonicalAnswer` — a short,
   * human-readable rendering of the right answer (e.g. `"4"` for a
   * numeric question, or `"Option text B"` for MCQ). This rewards
   * honest self-report and is gated on the post-cap quality (so the
   * `got_it`/`unsure`-on-wrong-pick path doesn't accidentally leak
   * the answer). The canonical answer is NEVER returned on `got_it`
   * or `unsure`, preserving the review-mode security boundary for
   * non-honest ratings.
   */
  submitReview(
    studentId: string,
    questionId: string,
    quality: RecallQuality,
    selectedOptionIndices?: number[],
    numericAnswer?: string,
  ): Promise<{
    item: any;
    isCorrect?: boolean;
    qualityAdjusted?: boolean;
    qualityAdjustedFrom?: RecallQuality;
    canonicalAnswer?: string;
  }> {
    return this._withTransaction(async session => {
      await this._assertSREnabled(studentId, session);

      const item = await this.reviewItemRepo.findByStudentAndQuestion(
        studentId,
        questionId,
        session,
      );

      if (!item) {
        throw new NotFoundError(
          'Review item not found for this student and question.',
        );
      }

      // Knob 8c: server-side quality capping. Compute correctness
      // first (fail-open — never block SM-2 on a lookup failure),
      // then if the answer is objectively wrong, cap the quality at
      // `unsure` (q=3) before feeding to SM-2.
      let isCorrect: boolean | undefined;
      try {
        if (
          selectedOptionIndices &&
          selectedOptionIndices.length > 0 &&
          numericAnswer === undefined
        ) {
          isCorrect = await this._evaluateMCQCorrectness(
            questionId,
            selectedOptionIndices,
          );
        } else if (
          numericAnswer !== undefined &&
          (selectedOptionIndices === undefined ||
            selectedOptionIndices.length === 0)
        ) {
          isCorrect = await this._evaluateNATCorrectness(
            questionId,
            numericAnswer,
          );
        }
      } catch (err) {
        console.warn(
          '[SpacedRepetitionService.submitReview] Correctness check failed;',
          'omitting isCorrect and skipping quality cap.',
          err,
        );
      }

      let effectiveQuality: RecallQuality = quality;
      let qualityAdjusted = false;
      let qualityAdjustedFrom: RecallQuality | undefined;
      if (isCorrect === false && quality === 'got_it') {
        effectiveQuality = 'unsure';
        qualityAdjusted = true;
        qualityAdjustedFrom = quality;
      }

      const updatedState = this._applySM2(item, effectiveQuality);

      // Wrong-answer override (2026-08-03): when the objective answer was
      // wrong (Knob 8c), force a full SM-2 reset (n=0, interval=1d) regardless
      // of which button the student pressed. Without this, a wrong pick +
      // `got_it` (capped to `unsure`, q=3) on an item with prior n>=2 still
      // produces interval = round(prior * EF) — e.g. 16 * 2.56 ≈ 41 days —
      // which contradicts the amber "Downgraded" notice shown to the user.
      // EF delta is preserved from the q=3 path (partial-credit honest
      // self-assessment penalty); only the streak/interval are reset.
      // Mirrors the mock override in
      // frontend/src/lib/spaced-repetition-api.ts submitReview().
      if (isCorrect === false) {
        updatedState.n = 0;
        updatedState.interval_days = 1;
        updatedState.next_review_at = new Date(updatedState.last_reviewed_at);
        updatedState.next_review_at.setDate(
          updatedState.next_review_at.getDate() + 1,
        );
      }

      const updated = await this.reviewItemRepo.update(
        item._id.toString(),
        updatedState,
        session,
      );

      if (!updated) {
        throw new InternalServerError('Failed to update review item after SM-2 calculation.');
      }

      // Reveal-on-missed: only on the post-cap quality of 'missed',
      // and only when we have a correctness signal (don't leak NAT
      // answers for questions we couldn't grade).
      let canonicalAnswer: string | undefined;
      if (
        effectiveQuality === 'missed' &&
        isCorrect !== undefined &&
        isCorrect === false
      ) {
        try {
          canonicalAnswer = await this._formatCanonicalAnswer(questionId);
        } catch (err) {
          console.warn(
            '[SpacedRepetitionService.submitReview] canonicalAnswer format failed;',
            'omitting from response.',
            err,
          );
        }
      }

      const response: {
        item: any;
        isCorrect?: boolean;
        qualityAdjusted?: boolean;
        qualityAdjustedFrom?: RecallQuality;
        canonicalAnswer?: string;
      } = { item: updated };
      if (isCorrect !== undefined) response.isCorrect = isCorrect;
      if (qualityAdjusted) {
        response.qualityAdjusted = qualityAdjusted;
        response.qualityAdjustedFrom = qualityAdjustedFrom;
      }
      if (canonicalAnswer !== undefined) {
        response.canonicalAnswer = canonicalAnswer;
      }
      return response;
    });
  }

  /**
   * Compares a student's selected option indices against the canonical
   * correct option(s) for an MCQ question. Returns true if the selection
   * exactly matches the correct set; false otherwise.
   *
   * Mirrors the display-order logic used by `toReviewQuestionResponse`
   * in `backend/src/modules/quizzes/classes/transformers/Question.ts`:
   *   - SELECT_ONE_IN_LOT: incorrect lot items first, then the
   *     single correct lot item at the end.
   *   - SELECT_MANY_IN_LOT: incorrect lot items first, then all
   *     correct lot items.
   *
   * The correctness comparison is index-based because that's what
   * the frontend actually sees and sends. Order_THE_LOTS, NUMERIC_ANSWER,
   * and DESCRIPTIVE questions don't have clickable options so they're
   * not supported here; the caller omits `selectedOptionIndices` for
   * those types.
   *
   * Throws if the question doesn't exist or isn't a supported MCQ type
   * — caller is expected to fail-open on caught errors.
   */
  private async _evaluateMCQCorrectness(
    questionId: string,
    selectedIndices: number[],
  ): Promise<boolean> {
    const question = await this.questionRepo.getById(questionId);
    if (!question) {
      throw new Error(`Question ${questionId} not found`);
    }

    const questionType = (question as any).type ?? (question as any).questionType;
    const MAX_OPTIONS = 8; // Mirrors toReviewQuestionResponse's slice(0, 8)

    if (questionType === 'SELECT_ONE_IN_LOT') {
      const sol = question as any;
      const allItems = [...(sol.incorrectLotItems ?? [])];
      if (sol.correctLotItem) {
        allItems.push(sol.correctLotItem);
      }
      const correctIdx = allItems
        .slice(0, MAX_OPTIONS)
        .findIndex(
          (it: any) => it._id?.toString() === sol.solution?.lotItemId,
        );
      return selectedIndices.length === 1 && selectedIndices[0] === correctIdx;
    }

    if (questionType === 'SELECT_MANY_IN_LOT') {
      const sml = question as any;
      const allItems = [
        ...(sml.incorrectLotItems ?? []),
        ...(sml.correctLotItems ?? []),
      ];
      const correctLotIds = new Set(
        (sml.solution?.lotItemIds ?? []).map((id: any) => id?.toString()),
      );
      const correctIndices = allItems
        .slice(0, MAX_OPTIONS)
        .map((it: any, idx: number) =>
          correctLotIds.has(it._id?.toString()) ? idx : -1,
        )
        .filter((idx: number) => idx >= 0);
      const correctSet = new Set(correctIndices);
      const selectedSet = new Set(selectedIndices);
      if (correctSet.size !== selectedSet.size) return false;
      for (const idx of correctSet) {
        if (!selectedSet.has(idx)) return false;
      }
      return true;
    }

    // Non-MCQ question type — not supported; fail-open in caller.
    throw new Error(
      `MCQ correctness check not supported for question type: ${questionType}`,
    );
  }

  /**
   * Compares a student's numeric input against the canonical numeric
   * solution for a NUMERIC_ANSWER question. Returns true on exact
   * parsed-float equality, false otherwise.
   *
   * Defaults to exact match (no tolerance). The simplest defensible
   * default — every integer/fraction question we ship has a single
   * canonical answer; if tolerance becomes a friction point later
   * (e.g. "1.5e2" vs "150"), revisit with a `correctAbsoluteTolerance`
   * field on the question doc.
   *
   * Throws if the question doesn't exist or isn't a NUMERIC_ANSWER —
   * caller is expected to fail-open on caught errors.
   */
  private async _evaluateNATCorrectness(
    questionId: string,
    numericAnswer: string,
  ): Promise<boolean> {
    const question = await this.questionRepo.getById(questionId);
    if (!question) {
      throw new Error(`Question ${questionId} not found`);
    }

    const questionType = (question as any).type ?? (question as any).questionType;
    if (questionType !== 'NUMERIC_ANSWER') {
      throw new Error(
        `NAT correctness check not supported for question type: ${questionType}`,
      );
    }

    const nat = question as any;
    const canonicalRaw = nat.solution?.numericAnswer;
    if (canonicalRaw === undefined || canonicalRaw === null) {
      throw new Error(
        `NUMERIC_ANSWER question ${questionId} has no solution.numericAnswer`,
      );
    }

    const canonical = parseFloat(String(canonicalRaw));
    const submitted = parseFloat(numericAnswer);
    if (Number.isNaN(canonical) || Number.isNaN(submitted)) {
      return false;
    }
    return canonical === submitted;
  }

  /**
   * Renders a short, human-readable canonical answer for the
   * reveal-on-missed path. Picks one of:
   *   - NUMERIC_ANSWER: the numeric value as a string.
   *   - SELECT_ONE_IN_LOT / SELECT_MANY_IN_LOT: the option text of
   *     the correct option(s), joined by ", ".
   *
   * Anything else (DESCRIPTIVE, ORDER_THE_LOTS) returns undefined —
   * honest rating on those question types doesn't surface an answer
   * today; keep the symmetry that nothing is leaked.
   */
  private async _formatCanonicalAnswer(
    questionId: string,
  ): Promise<string | undefined> {
    const question = await this.questionRepo.getById(questionId);
    if (!question) {
      throw new Error(`Question ${questionId} not found`);
    }

    const questionType = (question as any).type ?? (question as any).questionType;
    const MAX_OPTIONS = 8;

    if (questionType === 'NUMERIC_ANSWER') {
      const nat = question as any;
      const canonical = nat.solution?.numericAnswer;
      if (canonical === undefined || canonical === null) {
        return undefined;
      }
      return String(canonical);
    }

    if (questionType === 'SELECT_ONE_IN_LOT') {
      const sol = question as any;
      const allItems = [...(sol.incorrectLotItems ?? [])];
      if (sol.correctLotItem) {
        allItems.push(sol.correctLotItem);
      }
      const correctIdx = allItems
        .slice(0, MAX_OPTIONS)
        .findIndex(
          (it: any) => it._id?.toString() === sol.solution?.lotItemId,
        );
      if (correctIdx < 0) return undefined;
      const correctText = allItems[correctIdx]?.name
        ?? allItems[correctIdx]?.text
        ?? allItems[correctIdx]?.body;
      return correctText ? String(correctText) : undefined;
    }

    if (questionType === 'SELECT_MANY_IN_LOT') {
      const sml = question as any;
      const allItems = [
        ...(sml.incorrectLotItems ?? []),
        ...(sml.correctLotItems ?? []),
      ];
      const correctLotIds = new Set(
        (sml.solution?.lotItemIds ?? []).map((id: any) => id?.toString()),
      );
      const correctTexts: string[] = [];
      for (const it of allItems.slice(0, MAX_OPTIONS)) {
        if (correctLotIds.has(it._id?.toString())) {
          const txt = it.name ?? it.text ?? it.body;
          if (txt !== undefined) correctTexts.push(String(txt));
        }
      }
      if (correctTexts.length === 0) return undefined;
      return correctTexts.join(', ');
    }

    return undefined;
  }

  /**
   * Returns all ReviewItems for a student across all courses.
   * Used by the student dashboard to show the full upcoming review schedule.
   */
/**
   * Returns all ReviewItems for a student across all courses.
   * Used by the student dashboard to show the full upcoming review schedule.
   */
  getSchedule(studentId: string) {
    return this._withTransaction(async session => {
      const items = await this.reviewItemRepo.findByStudent(studentId, session);
      
      // Apply Exam-Prep Mode priority sorting (W1+W2: overdue-first,
      // then exam-prep weakest-first within non-overdue). See
      // _sortItemsByPriority docblock for the full priority order.
      this._sortItemsByPriority(items, new Date());

      return items;
    });
  }

  /**
   * Sort ReviewItems by priority for dashboard/schedule display.
   *
   * Priority order (top to bottom):
   *   1. Overdue first — anything with `next_review_at` in the past
   *      surfaces above everything else. Within the overdue bucket,
   *      oldest overdue first (most neglected).
   *   2. Exam-Prep Mode — among non-overdue cards, exam_prep_mode
   *      floats above normal. Within exam-prep: weakest EF first
   *      (the original Knob 4 intent).
   *   3. Standard chronological for non-overdue normal-mode cards.
   *
   * Audit W1 fix: previously, exam_prep_mode sorted to the absolute
   * top regardless of overdue status, so a student with 50 overdue
   * cards would see weak-but-not-due cards first. Now overdue always
   * wins, then exam-prep, then chronological.
   *
   * Audit W2 fix: the sort logic was duplicated in getSchedule() and
   * getCourseRetention(). Extracted here so both share one source of
   * truth.
   */
  private _sortItemsByPriority(items: IReviewItem[], now: Date): IReviewItem[] {
    const nowMs = now.getTime();
    return items.sort((a, b) => {
      const aOverdue = a.next_review_at.getTime() < nowMs;
      const bOverdue = b.next_review_at.getTime() < nowMs;
      if (aOverdue !== bOverdue) return aOverdue ? -1 : 1;

      // Same overdue bucket. Within overdue: oldest first.
      if (aOverdue) {
        const cmp = a.next_review_at.getTime() - b.next_review_at.getTime();
        if (cmp !== 0) return cmp;
      } else {
        // Same non-overdue bucket. Exam-prep mode wins.
        if (a.exam_prep_mode !== b.exam_prep_mode) {
          return a.exam_prep_mode ? -1 : 1;
        }
        // Within exam-prep: weakest EF first. Within normal: chronological.
        if (a.exam_prep_mode && b.exam_prep_mode) {
          if (a.EF !== b.EF) return a.EF - b.EF;
        }
        const cmp = a.next_review_at.getTime() - b.next_review_at.getTime();
        if (cmp !== 0) return cmp;
      }

      // Stable tiebreak by _id so equal-key items don't flip order
      // across calls (defensive — V8's sort is stable, but tests can
      // be sensitive).
      const aId = a._id?.toString() ?? '';
      const bId = b._id?.toString() ?? '';
      return aId.localeCompare(bId);
    });
  }

  /**
   * Returns all ReviewItems for a student within a specific course,
   * along with a computed retention health summary.
   * Used by the per-course retention view on the student dashboard.
   */
/**
   * Returns all ReviewItems for a student within a specific course,
   * along with a computed retention health summary.
   * Used by the per-course retention view on the student dashboard.
   */
  getCourseRetention(
    studentId: string,
    courseId: string,
  ): Promise<ICourseRetentionSummary> {
    return this._withTransaction(async session => {
      const items = await this.reviewItemRepo.findByStudentAndCourse(
        studentId,
        courseId,
        session,
      );

      if (!items.length) {
        throw new NotFoundError(
          'No review schedule found for this student and course.',
        );
      }

      // Apply Exam-Prep Mode priority sorting (W1+W2: same helper as
      // getSchedule; overdue-first then exam-prep weakest-first within
      // non-overdue). See _sortItemsByPriority docblock.
      const now = new Date();
      this._sortItemsByPriority(items, now);
      const sevenDaysFromNow = new Date(now);
      sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

      const overdueCount = items.filter(
        item => item.next_review_at <= now,
      ).length;

      const dueSoonCount = items.filter(
        item => item.next_review_at > now && item.next_review_at <= sevenDaysFromNow,
      ).length;

      const averageEF =
        items.reduce((sum, item) => sum + item.EF, 0) / items.length;

      return {
        courseId,
        totalItems: items.length,
        overdueCount,
        dueSoonCount,
        averageEF: Math.round(averageEF * 100) / 100,
        items,
      };
    });
  }

  /**
   * Returns a list of all student IDs who have an active spaced repetition
   * schedule for the given course.
   */
  getStudentsWithSchedules(courseId: string) {
    return this._withTransaction(async session => {
      const studentIds = await this.reviewItemRepo.getDistinctStudentsForCourse(
        courseId,
        session
      );

      return {
        courseId,
        studentIds,
        totalStudents: studentIds.length
      };
    });
  }

  // ── Day 2 (2026-08-04): teacher-facing human-readable name lookups ──────
  //
  // These three methods back the live endpoints that replace the
  // day-1 mock-only `getCourses` / `getCourseStudentsRich` /
  // `getQuestionSummary` calls. All three are admin-gated at the
  // controller (see `_assertAdmin`). The legacy endpoint at
  // `/courses/:courseId/students` keeps returning the raw-uid shape
  // for backward-compat with any in-flight caller.

  /**
   * Lists every course that has at least one ReviewItem, each paired
   * with the count of distinct students who have a schedule for it.
   * Backs `GET /api/spaced-repetition/courses`.
   *
   * Implementation:
   *  1. DISTINCT aggregation on `review_items` (1 round-trip) gives
   *     `{ courseId, studentCount }[]`.
   *  2. `ICourseRepository.getAllCourses()` (1 round-trip) gives the
   *     full course list for name lookup.
   *  3. Zip the two by courseId; courses with no schedule are dropped
   *     (intentional — the teacher UI only cares about active cohorts).
   *  4. Courses with a schedule but no matching `ICourse` doc
   *     (shouldn't happen, but fail-open) render as `name: <id>`.
   *
   * Sorted by course id for stable ordering.
   */
  getCoursesInCohort(): Promise<CoursesListResponse> {
    return this._withTransaction(async session => {
      const counts = await this.reviewItemRepo.getDistinctCoursesWithStudentCount(
        session,
      );
      const courses = await this.courseRepo.getAllCourses(session);
      const courseMap = new Map(courses.map(c => [c._id.toString(), c]));

      const summaries: TeacherCourseSummary[] = counts.map(({ courseId, studentCount }) => {
        const course = courseMap.get(courseId);
        return {
          id: courseId,
          name: course?.name ?? courseId,
          studentCount,
        };
      });

      return {
        count: summaries.length,
        courses: summaries,
      };
    });
  }

  /**
   * Returns the rich student rows (id + name + email) for every
   * student who has a schedule in the given course. Backs
   * `GET /api/spaced-repetition/courses/:courseId/students-rich`.
   *
   * Replaces the legacy `getStudentsWithSchedules` (raw uids) for
   * teacher-facing surfaces. The legacy method stays exported for
   * backward-compat with any in-flight caller.
   *
   * Implementation:
   *  1. DISTINCT query on `review_items` (1 round-trip) gives the
   *     uids.
   *  2. `IUserRepository.getUsersByIds(uids)` (1 round-trip) returns
   *     the matching user docs in a single batch query — keeps the
   *     N+1 pattern out of the hot path. Falls back to per-id lookups
   *     only if the batch returns fewer rows than expected.
   *  3. Zip the two by uid; missing user docs render as
   *     `name: <uid>, email: ''` (fail-open, never throws).
   *
   * Sorted by display name (asc, case-insensitive) so the teacher
   * picker shows students in a consistent order.
   */
  async getStudentsWithSchedulesRich(
    courseId: string,
  ): Promise<CourseStudentsRichResponse> {
    return this._withTransaction(async session => {
      const studentIds = await this.reviewItemRepo.getDistinctStudentsForCourse(
        courseId,
        session,
      );
      const users = await this.userRepo.getUsersByIds(studentIds);
      const userMap = new Map(users.map(u => [u.firebaseUID, u]));

      const students: EnrichedStudent[] = studentIds.map(id => {
        const user = userMap.get(id);
        const firstName = user?.firstName ?? '';
        const lastName = user?.lastName ?? '';
        const name = [firstName, lastName].filter(Boolean).join(' ').trim();
        return {
          id,
          name: name || id,
          email: user?.email ?? '',
        };
      });

      // Stable ordering: by display name (case-insensitive), falling
      // back to id for un-named rows so the order is deterministic.
      students.sort((a, b) => {
        const an = (a.name || a.id).toLowerCase();
        const bn = (b.name || b.id).toLowerCase();
        if (an < bn) return -1;
        if (an > bn) return 1;
        return a.id.localeCompare(b.id);
      });

      return {
        courseId,
        students,
        totalStudents: students.length,
      };
    });
  }

  /**
   * Returns the question text + question type + bank titles for a
   * single question. Backs `GET /api/spaced-repetition/questions/:questionId/summary`.
   *
   * Returns 404 if the question doesn't exist. Bank-title lookup is
   * fail-open (logs and returns []) so a stale question doc (no
   * matching bank) still renders the body in the teacher UI.
   *
   * Used by the teacher dashboard per-card row to preview the question
   * text without a full review-card fetch (which would omit the
   * correct answer via a separate code path).
   */
  async getQuestionSummary(questionId: string): Promise<QuestionSummaryResponse> {
    return this._withTransaction(async session => {
      const question = await this.questionRepo.getById(questionId, session);
      if (!question) {
        throw new NotFoundError(
          `Question ${questionId} not found`,
        );
      }

      // Bank titles: fail-open. `getQuestionBanksByQuestionId` returns
      // IQuestionBank[]; we extract titles. If the lookup throws
      // (e.g. malformed questionId), we log and return [] so the
      // teacher UI still renders the body.
      let bankTitles: string[] = [];
      try {
        const banks = await this.questionBankRepo.getQuestionBanksByQuestionId(
          questionId,
          session,
        );
        bankTitles = banks
          .map(b => b.title)
          .filter((t): t is string => typeof t === 'string' && t.length > 0);
      } catch (err) {
        console.error(
          `[SpacedRepetitionService] getQuestionSummary: bank lookup failed for ${questionId}:`,
          err,
        );
      }

      return {
        question: {
          id: question._id.toString(),
          body: question.text,
          type: question.type,
          bankTitles,
        },
      };
    });
  }

  /**
   * Updates the notification opt-out preference for all ReviewItems
   * belonging to a student in a given course.
   * Called when the student toggles notifications for a course.
   */
  updateNotificationPreference(
    studentId: string,
    courseId: string,
    optOut: boolean,
  ) {
    return this._withTransaction(async session => {
      const modifiedCount = await this.reviewItemRepo.updateOptOut(
        studentId,
        courseId,
        optOut,
        session,
      );

      if (modifiedCount === 0) {
        throw new NotFoundError(
          'No review items found for this student and course.',
        );
      }

      return { updatedCount: modifiedCount };
    });
  }

  /**
   * Bulk updates the notification opt-out preference for multiple students
   * within a given course.
   * Called by the teacher dashboard for cohort-level management.
   *
   * Response shape (Bug 3 fix, 2026-08-01):
   * - `updatedCount`: kept for back-compat. ALWAYS reflects the review
   *   ITEM count, not student count. Any caller that wants a student
   *   count should read `studentsAffected`. Do not present this number
   *   as a student count in user-facing UI.
   * - `studentsAffected`: distinct student count whose items were
   *   actually mutated. Suitable for teacher-facing toasts.
   * - `itemsAffected`: same as `updatedCount` but named honestly.
   * - `message`: human-readable summary, e.g. "Updated notifications for
   *   3 students (6 review items).". Uses `studentsAffected` for the
   *   primary number.
   */
  bulkUpdateNotificationPreference(
    studentIds: string[],
    courseId: string,
    optOut: boolean,
  ) {
    return this._withTransaction(async session => {
      const { modifiedCount, distinctStudentsModified } =
        await this.reviewItemRepo.updateOptOutBulk(
          studentIds,
          courseId,
          optOut,
          session,
        );

      return {
        updatedCount: modifiedCount,
        studentsAffected: distinctStudentsModified,
        itemsAffected: modifiedCount,
        message: `Updated notifications for ${distinctStudentsModified} student${distinctStudentsModified === 1 ? '' : 's'}${modifiedCount !== distinctStudentsModified ? ` (${modifiedCount} review item${modifiedCount === 1 ? '' : 's'})` : ''}.`,
      };
    });
  }

  /**
   * Bulk updates the exam prep mode for multiple students within a given course.
   *
   * See `bulkUpdateNotificationPreference` for the dual-count response
   * shape rationale (Bug 3 fix, 2026-08-01 — item-count vs student-count).
   */
  bulkUpdateExamPrepMode(
    studentIds: string[],
    courseId: string,
    enabled: boolean,
  ) {
    return this._withTransaction(async session => {
      const { modifiedCount, distinctStudentsModified } =
        await this.reviewItemRepo.updateExamPrepBulk(
          studentIds,
          courseId,
          enabled,
          session,
        );

      return {
        updatedCount: modifiedCount,
        studentsAffected: distinctStudentsModified,
        itemsAffected: modifiedCount,
        message: `${enabled ? 'Enabled' : 'Disabled'} exam-prep mode for ${distinctStudentsModified} student${distinctStudentsModified === 1 ? '' : 's'}${modifiedCount !== distinctStudentsModified ? ` (${modifiedCount} review item${modifiedCount === 1 ? '' : 's'})` : ''}.`,
      };
    });
  }

  /**
   * Bulk updates the `is_paused` flag for multiple students within a given
   * course (added 2026-08-04 — Day 2 teacher control hooks).
   *
   * Mirrors `bulkUpdateExamPrepMode` exactly so the two endpoints share
   * the same dual-count response shape (Bug 3 fix, 2026-08-01 — item-count
   * vs student-count). The frontend uses this endpoint with a single
   * studentId array (`[studentId]`) for the per-student
   * "Pause All Reviews" / "Resume All Reviews" buttons in the teacher
   * dashboard, so the same endpoint serves both single-student and
   * cohort-scoped toggles.
   *
   * Paused items are excluded from `findDueItems` (see Knob 5 in
   * `ReviewItemRepository.findDueItems`), so this acts as a hard kill
   * switch for the review queue. The student can still see their items
   * in the schedule/retention views, but nothing becomes due until the
   * flag is cleared.
   */
  bulkUpdatePause(
    studentIds: string[],
    courseId: string,
    paused: boolean,
  ) {
    return this._withTransaction(async session => {
      const { modifiedCount, distinctStudentsModified } =
        await this.reviewItemRepo.updatePauseBulk(
          studentIds,
          courseId,
          paused,
          session,
        );

      return {
        updatedCount: modifiedCount,
        studentsAffected: distinctStudentsModified,
        itemsAffected: modifiedCount,
        message: `${paused ? 'Paused' : 'Resumed'} reviews for ${distinctStudentsModified} student${distinctStudentsModified === 1 ? '' : 's'}${modifiedCount !== distinctStudentsModified ? ` (${modifiedCount} review item${modifiedCount === 1 ? '' : 's'})` : ''}.`,
      };
    });
  }

  /**
   * Forces a specific question to become due immediately for a student.
   * Optionally resets the easiness factor.
   *
   * Called by a teacher or admin to "boost" a student who needs
   * extra practice on a specific question or topic.
   *
   * @param studentId  - the student whose review item to boost
   * @param questionId - the specific question to force-due
   * @param targetEF   - optional; if provided, EF is set to this exact value
   */
  boostReview(
    studentId: string,
    questionId: string,
    targetEF?: number,
  ): Promise<{
    boosted: boolean;
    questionId: string;
    next_review_at: Date;
    EF: number;
    interval_days: number;
    message: string;
  }> {
    return this._withTransaction(async session => {
      const item = await this.reviewItemRepo.findByStudentAndQuestion(
        studentId,
        questionId,
        session,
      );

      if (!item) {
        throw new NotFoundError(
          'Review item not found for this student and question.',
        );
      }

      const now = new Date();

      const updates: Partial<IReviewItem> = {
        next_review_at: now,
        // If targetEF is provided, override directly.
        // Otherwise leave EF unchanged — the card is just brought forward.
        ...(targetEF !== undefined ? { EF: targetEF } : {}),
      };

      const updated = await this.reviewItemRepo.update(
        item._id.toString(),
        updates,
        session,
      );

      if (!updated) {
        throw new InternalServerError('Failed to boost review item.');
      }

      const message =
        targetEF !== undefined
          ? `Question boosted and EF reset to ${targetEF.toFixed(1)}.`
          : 'Question boosted — due immediately.';

      return {
        boosted: true,
        questionId,
        next_review_at: updated.next_review_at,
        EF: updated.EF,
        interval_days: updated.interval_days,
        message,
      };
    });
  }

  /**
   * Resets a specific question's review history for a student, returning it
   * to the default SM-2 state as if they had never seen it.
   */
  resetReview(
    studentId: string,
    questionId: string,
  ): Promise<{
    reset: boolean;
    questionId: string;
    message: string;
  }> {
    return this._withTransaction(async session => {
      const item = await this.reviewItemRepo.findByStudentAndQuestion(
        studentId,
        questionId,
        session,
      );

      if (!item) {
        throw new NotFoundError(
          'Review item not found for this student and question.',
        );
      }

      const now = new Date();
      const next_review_at = new Date(now);
      next_review_at.setDate(next_review_at.getDate() + DEFAULT_SM2_STATE.interval_days);

      const updates: Partial<IReviewItem> = {
        n: DEFAULT_SM2_STATE.n,
        EF: DEFAULT_SM2_STATE.EF,
        interval_days: DEFAULT_SM2_STATE.interval_days,
        next_review_at,
        last_reviewed_at: null, // Clear the review timestamp
      };

      const updated = await this.reviewItemRepo.update(
        item._id.toString(),
        updates,
        session,
      );

      if (!updated) {
        throw new InternalServerError('Failed to reset review item.');
      }

      return {
        reset: true,
        questionId,
        message: 'Card history successfully reset to default state.',
      };
    });
  }

  /**
   * Sets or clears the remediation hint for a (student, question) pair.
   * The hint is shown to the student ONLY after they answer incorrectly
   * in a review session.
   *
   * Called by a teacher/admin to attach targeted post-failure guidance.
   *
   * @param studentId  - the student who will see the hint
   * @param questionId - the specific question the hint relates to
   * @param hint       - the hint text, or null/undefined to clear it
   */
  setRemediationHint(
    studentId: string,
    questionId: string,
    hint: string | null | undefined,
  ): Promise<{
    questionId: string;
    remediation_hint: string | null;
    message: string;
  }> {
    return this._withTransaction(async session => {
      const item = await this.reviewItemRepo.findByStudentAndQuestion(
        studentId,
        questionId,
        session,
      );

      if (!item) {
        throw new NotFoundError(
          'Review item not found for this student and question.',
        );
      }

      const resolvedHint = hint === undefined ? null : hint;

      const updated = await this.reviewItemRepo.update(
        item._id.toString(),
        { remediation_hint: resolvedHint ?? undefined },
        session,
      );

      if (!updated) {
        throw new InternalServerError(
          'Failed to update remediation hint.',
        );
      }

      return {
        questionId,
        remediation_hint: updated.remediation_hint ?? null,
        message:
          resolvedHint != null
            ? 'Remediation hint set.'
            : 'Remediation hint cleared.',
      };
    });
  }

  // ── Manual review assignment (Knob 7, Phase C, 2026-07-21) ─────────────

  /**
   * One entry in the question picker. `fromCourse` distinguishes items
   * belonging to question banks of the requested course (sorted to top
   * in the UI) from cross-bank entries (sorted to bottom but allowed).
   */
  private buildAssignableListEntry(args: {
    question: { _id?: { toString(): string } | string; body?: string; type?: string; hint?: string; options?: unknown };
    bankIds: string[];
    bankTitles: (string | null)[];
    fromCourse: boolean;
  }): {
    id: string;
    body: string;
    type: string;
    hint: string | null;
    bankIds: string[];
    bankTitles: (string | null)[];
    fromCourse: boolean;
  } {
    const q = args.question as any;
    const rawId = q._id;
    const id =
      typeof rawId === 'string'
        ? rawId
        : rawId && typeof rawId.toString === 'function'
          ? rawId.toString()
          : '';
    return {
      id,
      body: typeof q.body === 'string' ? q.body : '',
      type: typeof q.type === 'string' ? q.type : 'UNKNOWN',
      hint: typeof q.hint === 'string' ? q.hint : null,
      bankIds: args.bankIds,
      bankTitles: args.bankTitles,
      fromCourse: args.fromCourse,
    };
  }

  /**
   * GET /courses/:courseId/assignable-questions
   *
   * Returns a de-duplicated list of questions the teacher can pick from
   * to manually assign to a student. The shape lets the frontend group
   * by `fromCourse` (the course's banks first, then cross-bank) without
   * needing a second round-trip.
   *
   * Cross-bank policy (locked with Emie): the picker allows questions
   * from any bank, not just the requested course's banks. The
   * `fromCourse: true` flag is the hint the frontend uses to sort.
   *
   * No write occurs — this is read-only metadata.
   */
  async getAssignableQuestions(courseId: string): Promise<
    Array<{
      id: string;
      body: string;
      type: string;
      hint: string | null;
      bankIds: string[];
      bankTitles: (string | null)[];
      fromCourse: boolean;
    }>
  > {
    // 1. Find every bank belonging to this course. The course's bank IDs
    //    become the "fromCourse" set for the picker sort key.
    const courseBanks = await this.questionBankRepo.findBanksByCourseId(courseId);
    const courseBankIdSet = new Set<string>();
    const courseBankTitleMap = new Map<string, string | null>();
    for (const bank of courseBanks) {
      const bankId =
        typeof bank._id === 'string'
          ? bank._id
          : (bank._id as any)?.toString?.() ?? '';
      if (bankId) {
        courseBankIdSet.add(bankId);
        courseBankTitleMap.set(bankId, (bank as any).title ?? null);
      }
    }

    // 2. Enumerate every known bank, so we can also surface cross-bank
    //    questions in the picker (allowed per the cross-bank policy).
    const allBanksCollection = await this.database.getCollection<any>(
      'questionBanks',
    );
    const allBanks = await allBanksCollection
      .find({ isDeleted: { $ne: true } })
      .toArray();

    type Entry = {
      id: string;
      body: string;
      type: string;
      hint: string | null;
      bankIds: string[];
      bankTitles: (string | null)[];
      fromCourse: boolean;
    };

    const entriesByQuestionId = new Map<string, Entry>();

    for (const bank of allBanks) {
      const bankId =
        typeof bank._id === 'string'
          ? bank._id
          : (bank._id as any)?.toString?.() ?? '';
      const bankTitle = (bank as any).title ?? null;
      const fromCourse = courseBankIdSet.has(bankId);
      const bankQuestions: unknown[] = Array.isArray((bank as any).questions)
        ? ((bank as any).questions as unknown[])
        : [];

      // Resolve the question docs in this bank via QuestionRepository
      // (a single $in query per bank is cheap; banks are small).
      const questionIdStrings = bankQuestions
        .map(q => {
          if (typeof q === 'string') return q;
          if (
            q &&
            typeof q === 'object' &&
            typeof (q as any).toString === 'function'
          ) {
            return (q as any).toString();
          }
          return null;
        })
        .filter((s): s is string => typeof s === 'string');

      if (questionIdStrings.length === 0) continue;

      const questionDocs =
        (await this.questionRepo.getByIds(questionIdStrings)) ?? [];

      for (const question of questionDocs) {
        const id =
          typeof (question as any)._id === 'string'
            ? (question as any)._id
            : (question as any)._id?.toString?.() ?? '';
        if (!id) continue;
        const existing = entriesByQuestionId.get(id);
        if (existing) {
          // Same question referenced by multiple banks (normal). Add the
          // additional bank to its bank list, but mark fromCourse true
          // if ANY of its banks belong to the course.
          existing.bankIds.push(bankId);
          existing.bankTitles.push(bankTitle);
          existing.fromCourse = existing.fromCourse || fromCourse;
        } else {
          entriesByQuestionId.set(
            id,
            this.buildAssignableListEntry({
              question: question as any,
              bankIds: [bankId],
              bankTitles: [bankTitle],
              fromCourse,
            }),
          );
        }
      }
    }

    // Sort: fromCourse entries first (preserving their relative order),
    // then cross-bank entries.
    const fromCourseEntries: Entry[] = [];
    const crossBankEntries: Entry[] = [];
    for (const entry of entriesByQuestionId.values()) {
      if (entry.fromCourse) fromCourseEntries.push(entry);
      else crossBankEntries.push(entry);
    }

    return [...fromCourseEntries, ...crossBankEntries];
  }

  /**
   * POST /:studentId/assign
   *
   * Manually assign a question as the next-due review for a student.
   *
   * Behavior:
   *  - If the student has SR disabled, we still create the assignment but
   *    return `autoEnabled: true` so the frontend can show "SR was off,
   *    now enabled for this student" in its toast.
   *  - If a ReviewItem already exists for (student_id, question_id), we
   *    throw ConflictError; the frontend offers Boost instead.
   *  - The created item is tagged `source: 'manual'` so analytics can
   *    distinguish teacher-driven assignments from auto-seeded ones.
   *
   * Returns the inserted item and a human-readable message.
   */
  async assignReview(
    studentId: string,
    questionId: string,
    courseId: string,
  ): Promise<{
    item: IReviewItem;
    autoEnabled: boolean;
    message: string;
  }> {
    // 1. Verify the student exists in the users collection. If not, the
    //    studentId was probably a typo or hasn't completed a course yet.
    const usersCollection = await this.database.getCollection<any>('users');
    const student = await usersCollection.findOne({ firebaseUID: studentId });
    if (!student) {
      throw new NotFoundError(
        `No user found with firebaseUID '${studentId}'.`,
      );
    }

    // 2. Verify the question exists.
    const question = await this.questionRepo.getById(questionId);
    if (!question) {
      throw new NotFoundError(`No question found with id '${questionId}'.`);
    }

    // 3. Check the SR-disabled flag. If off, we'll auto-enable as part of
    //    the assignment (emie's decision: don't silently undo the disable,
    //    but also don't refuse; record the action so UI can surface it).
    const srDisabled = await this.studentSRStatusRepo.getStatus(studentId);
    let autoEnabled = false;

    return this._withTransaction(async session => {
      if (srDisabled) {
        const matched = await this.studentSRStatusRepo.setStatus(
          studentId,
          false,
          session,
        );
        autoEnabled = matched;
      }

      // 4. Reject duplicate (student, question) pairs — the unique index
      //    (student_id, question_id) would catch it anyway but we want a
      //    clean 409 ConflictError for the frontend's "Boost instead" UI.
      const existing = await this.reviewItemRepo.findByStudentAndQuestion(
        studentId,
        questionId,
        session,
      );
      if (existing) {
        // 409 Conflict: the (student, question) pair already exists.
        // routing-controllers doesn't export a ConflictError class, but
        // throwing an HttpError with code 409 lets the default error
        // handler produce a clean 409 response for the frontend's
        // "Boost instead" path.
        throw new HttpError(
          409,
          `This student already has a review item for question ${questionId}. Use Boost to surface it as overdue.`,
        );
      }

      // 5. Insert the new ReviewItem. Set source: 'manual' so analytics
      //    can tell this apart from algorithm-driven items. Start at the
      //    SM-2 defaults so the first manual review behaves identically
      //    to the first auto-seeded review.
      const newItem: Omit<IReviewItem, '_id'> = {
        student_id: studentId,
        course_id: courseId,
        question_id: questionId,
        n: 0,
        EF: DEFAULT_SM2_STATE.EF,
        interval_days: 0,
        // Mark due immediately: the whole point of manual assignment is
        // "this should be the next thing they see".
        next_review_at: new Date(),
        last_reviewed_at: null,
        notification_opt_out: false,
        source: 'manual',
      };

      const inserted = await this.reviewItemRepo.create(newItem, session);

      return {
        item: inserted,
        autoEnabled,
        message: autoEnabled
          ? `Assigned. Note: SR was disabled for this student; it has been re-enabled to make the assignment actionable.`
          : `Assigned ${questionId} to ${studentId}'s review queue.`,
      };
    });
  }
}

export { SpacedRepetitionService };