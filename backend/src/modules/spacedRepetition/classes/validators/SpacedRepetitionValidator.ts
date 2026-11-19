import {
  IsString,
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsEnum,
  IsOptional,
  IsNumber,
  Min,
  Max,
  ArrayMinSize,
  MaxLength,
} from 'class-validator';
import { RecallQuality } from '#spacedRepetition/interfaces/IReviewItem.js';

// ── Remediation hint DTOs (Knob 2) ─────────────────────────────────────────

/**
 * Body for PATCH /:studentId/remediation-hint
 * Sent by a teacher/admin to attach or update a targeted hint for a student
 * on a specific question. The hint is shown to the student ONLY after they
 * answer incorrectly in a review session.
 */
export class SetRemediationHintBody {
  @IsString()
  @IsNotEmpty()
  questionId: string;

  /** The hint text to show after an incorrect answer. Pass null to clear. */
  @IsOptional()
  @IsString()
  @MaxLength(200, {
    message: 'Remediation hint must be 200 characters or fewer.',
  })
  hint?: string | null;
}

/**
 * Response for PATCH /:studentId/remediation-hint
 */
export class SetRemediationHintResponse {
  questionId: string;
  remediation_hint: string | null;
  message: string;
}

// ── SR-disabled DTOs (Knob 6) ───────────────────────────────────────────────

/**
 * Body for PATCH /students/:studentId/sr-disabled
 * Sent by a teacher to enable or disable SR for a specific student.
 * When true, the student's reviews stop accumulating and reminders stop firing.
 */
export class SetStudentSRDisabledBody {
  @IsBoolean()
  sr_disabled: boolean;
}

/**
 * Response for PATCH /students/:studentId/sr-disabled
 */
export class SetStudentSRDisabledResponse {
  studentId: string;
  sr_disabled: boolean;
  message: string;
}

/**
 * Response for GET /students/:studentId/status
 * Lightweight read used by the student dashboard to choose empty-state copy.
 */
export class StudentSRStatusResponse {
  studentId: string;
  sr_disabled: boolean;
}

/**
 * Body for PATCH /bulk/sr-disabled
 * Sent by a teacher to bulk enable/disable SR for a cohort.
 * studentIds is optional — if omitted, applies to every student with a
 * review schedule in the given course.
 */
export class BulkSetStudentSRDisabledBody {
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  studentIds: string[];

  @IsBoolean()
  sr_disabled: boolean;
}

/**
 * Response for PATCH /bulk/sr-disabled
 */
export class BulkSetStudentSRDisabledResponse {
  /** @deprecated Student count. See BulkPauseResponse. */
  updatedCount: number;

  /** Distinct student count the bulk touched (Mongo `matchedCount`). */
  studentsAffected: number;

  /** Student count whose `sr_disabled` flag actually changed (Mongo `modifiedCount`). */
  itemsAffected: number;

  /** Human-readable summary, e.g. "Disabled SR for 3 students (0 state changes)." */
  message: string;
}

// ── Teacher human-readable name lookups (Day 2, 2026-08-04) ──────────────
//
// Teacher-facing surface replacements for the raw-id endpoints
// (Day 1 frontend used mock directories; these endpoints back the live
// path). Every endpoint is admin-only (gated by the controller's
// `_assertAdmin`). All lookups are fail-open: a missing course / user
// doc returns null name/email rather than throwing, so the teacher
// UI still renders with graceful-degradation copy.

/**
 * One entry in `GET /api/spaced-repetition/courses` response.
 * Mirrors the frontend `TeacherCourseSummary` interface in
 * `frontend/src/types/spaced-repetition.types.ts` (single source of
 * truth — types match field-for-field).
 *
 * `studentCount` is the number of distinct students with at least
 * one ReviewItem for this course (computed via `distinct` on the
 * `review_items` collection). Returns 0 for courses with no seeded
 * schedules — the teacher UI renders the row but shows "0 students".
 */
export class TeacherCourseSummary {
  id: string;
  name: string;
  studentCount: number;
}

/**
 * Response for `GET /api/spaced-repetition/courses`.
 * Includes the raw count alongside the array so the frontend can
 * decide whether to render the picker empty-state without an extra
 * `length` lookup.
 */
export class CoursesListResponse {
  count: number;
  courses: TeacherCourseSummary[];
}

/**
 * One entry in `GET /api/spaced-repetition/courses/:courseId/students-rich`
 * response. Mirrors the frontend `EnrichedStudent` interface.
 *
 * `name` is the joined display string (firstName + ' ' + lastName?),
 * used as the primary label in the teacher UI. `email` is included
 * so the teacher can disambiguate students with identical names.
 */
export class EnrichedStudent {
  id: string;
  name: string;
  email: string;
}

/**
 * Response for `GET /api/spaced-repetition/courses/:courseId/students-rich`.
 * Replaces the legacy `{courseId, studentIds, totalStudents}` shape
 * with rich rows. The legacy endpoint at `/courses/:courseId/students`
 * keeps returning the old shape for backward-compat with any
 * in-flight caller.
 */
export class CourseStudentsRichResponse {
  courseId: string;
  students: EnrichedStudent[];
  totalStudents: number;
}

/**
 * Response for `GET /api/spaced-repetition/questions/:questionId/summary`.
 * Day 2 / August 2026: the teacher dashboard's per-card row needs the
 * question text to be human-readable (option 1 from the Day 1 plan).
 *
 * `body` is mapped from `IQuestion.text` so the frontend can use the
 * same field name whether the question is shown in the review card
 * (existing `getForReview` returns `body`) or in the teacher cohort
 * view (this new endpoint).
 *
 * `bankTitles` is the list of bank titles that reference this
 * question. The teacher UI only needs the existence + count, but
 * the names help when debugging "why is this question appearing for
 * this course?" — keeps the live backend aligned with the assignable
 * endpoint's `bankTitles[]` shape.
 *
 * `type` mirrors `IQuestion.type` so the teacher UI can render a
 * question-type badge (SOL / SML / OTL / NAT / DES) without a
 * separate fetch.
 */
export class QuestionSummary {
  id: string;
  body: string;
  type: string;
  bankTitles: string[];
}

export class QuestionSummaryResponse {
  question: QuestionSummary;
}

// ── Request bodies ─────────────────────────────────────────────────────────

/**
 * Body for POST /:studentId/seed
 * Sent by the course completion hook to seed a review schedule.
 */
export class SeedScheduleBody {
  @IsString()
  @IsNotEmpty()
  courseId: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  questionIds: string[];
}

/**
 * Body for POST /:studentId/review
 * Sent when a student submits their response to a review question.
 *
 * `selectedOptionIndices` is OPTIONAL and only used for MCQ question types
 * (SELECT_ONE_IN_LOT, SELECT_MANY_IN_LOT). When present, the service
 * compares the indices against the question's correct option(s) and
 * returns `isCorrect` in the response. The frontend uses this to light
 * up the chosen option(s) green (correct) or red (incorrect) — without
 * ever revealing the correct option to the student when they got it
 * wrong (per the 2026-07-21 UX rule).
 *
 * Omitted for NUMERIC_ANSWER_TYPE and DESCRIPTIVE question types.
 */
export class SubmitReviewBody {
  @IsString()
  @IsNotEmpty()
  questionId: string;

  @IsEnum(['got_it', 'unsure', 'missed'] as const satisfies RecallQuality[])
  quality: RecallQuality;

  /**
   * Indices into the review-mode `options[]` array (the order the
   * student saw them in). For SELECT_ONE_IN_LOT this is a single
   * element; for SELECT_MANY_IN_LOT it can be multiple. Optional —
   * omitted for non-MCQ question types.
   */
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsNumber({}, { each: true })
  @Min(0, { each: true })
  @Max(7, { each: true })
  selectedOptionIndices?: number[];

  /**
   * String the student typed for a NUMERIC_ANSWER question. The server
   * parses it with `parseFloat` and compares against the question's
   * `solution.numericAnswer` (exact match, no tolerance).
   *
   * Optional — omitted for MCQ question types (which use
   * `selectedOptionIndices`) and for question types we can't grade
   * server-side (DESCRIPTIVE, ORDER_THE_LOTS).
   */
  @IsOptional()
  @IsString()
  numericAnswer?: string;
}

/**
 * Response for POST /:studentId/review.
 * Returns the updated ReviewItem after SM-2 recalculation plus
 * integrity feedback (Knob 8c, 2026-07-29).
 *
 * Field semantics:
 *   - `item` — the updated ReviewItem docs.
 *   - `isCorrect` — populated when the request included an objective
 *      answer signal (`selectedOptionIndices` for MCQ, or `numericAnswer`
 *      for NUMERIC_ANSWER). `undefined` for ungraded question types.
 *   - `qualityAdjusted` — `true` when the server capped the student's
 *      quality (e.g. a wrong pick that was rated `got_it` was
 *      downgraded to `unsure`). Always `false`/undefined if the
 *      student's claim was honest.
 *   - `qualityAdjustedFrom` — the quality the client claimed before
 *      the cap (`got_it` only today). Only set when `qualityAdjusted`
 *      is true. Lets the frontend surface a "downgraded" notice.
 *   - `canonicalAnswer` — short human-readable canonical answer,
 *      populated ONLY when the (post-cap) quality is `missed` AND
 *      the question was objectively gradable (NAT or MCQ). The
 *      reveal-on-missed affordance rewards honest self-report; we
 *      never leak the answer on `got_it` or `unsure`.
 */
export class SubmitReviewResponse {
  item: any; // IReviewItem shape; left `any` to avoid an extra import
  isCorrect?: boolean;
  qualityAdjusted?: boolean;
  qualityAdjustedFrom?: RecallQuality;
  canonicalAnswer?: string;
}

/**
 * Body for PATCH /:studentId/notifications
 * Sent when a student toggles notification preferences for a course.
 */
export class UpdateOptOutBody {
  @IsString()
  @IsNotEmpty()
  courseId: string;

  @IsBoolean()
  optOut: boolean;
}

/**
 * Body for PATCH /bulk/notifications
 * Sent by a teacher to bulk pause/resume notifications for a cohort of students in a course.
 */
export class BulkUpdateOptOutBody {
  @IsString()
  @IsNotEmpty()
  courseId: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  studentIds: string[];

  @IsBoolean()
  optOut: boolean;
}

/**
 * Response for PATCH /bulk/notifications
 *
 * Bug 3 fix (2026-08-01): the response now distinguishes between the
 * number of distinct students whose items were mutated
 * (`studentsAffected`) and the raw review-item count (`itemsAffected`).
 * Previously the response only had `updatedCount`, which was always the
 * item count but was being mislabelled as a student count in the
 * teacher UI. The frontend toast must use `studentsAffected` for any
 * "for N students" wording.
 *
 * `updatedCount` is kept for back-compat with any external consumer
 * that already reads it. It is ALWAYS the item count (alias of
 * `itemsAffected`) and must NOT be presented as a student count.
 */
export class BulkUpdateOptOutResponse {
  /**
   * @deprecated Item count, NOT student count. Use `studentsAffected`
   *   for student-facing UI and `itemsAffected` when item-level accuracy
   *   matters. Kept so existing consumers don't break.
   */
  updatedCount: number;

  /**
   * Number of distinct students whose review items were actually
   * mutated. Suitable for teacher-facing UI ("Updated for 3 students").
   */
  studentsAffected: number;

  /**
   * Number of ReviewItem docs the bulk update actually changed
   * (Mongo `modifiedCount` semantics).
   */
  itemsAffected: number;

  /**
   * Human-readable summary, e.g.
   * "Updated notifications for 3 students (6 review items).".
   */
  message: string;
}

/**
 * Body for PATCH /bulk/exam-prep
 */
export class BulkExamPrepBody {
  @IsString()
  @IsNotEmpty()
  courseId: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  studentIds: string[];

  @IsBoolean()
  enabled: boolean;
}

/**
 * Response for PATCH /bulk/exam-prep
 *
 * See `BulkUpdateOptOutResponse` for the dual-count rationale (Bug 3,
 * 2026-08-01). Same shape; same `updatedCount` back-compat rule.
 */
export class BulkExamPrepResponse {
  /** @deprecated Item count, NOT student count. See BulkUpdateOptOutResponse. */
  updatedCount: number;

  /** Distinct student count whose items were mutated. */
  studentsAffected: number;

  /** Raw review-item count mutated (Mongo `modifiedCount`). */
  itemsAffected: number;

  /** Human-readable summary, e.g. "Enabled exam-prep mode for 3 students.". */
  message: string;
}

/**
 * Body for PATCH /bulk/pause
 * Bulk toggle of the `is_paused` flag on all review items for the given
 * students within a specific course. Paused items are excluded from the
 * `findDueItems` query, so they never surface in the review queue until
 * they are resumed (added 2026-08-04 — Day 2 teacher control hooks).
 *
 * Mirrors `BulkExamPrepBody` exactly so the two endpoints share the
 * teacher mental model: "for these students in this course, flip flag X".
 */
export class BulkPauseBody {
  @IsString()
  @IsNotEmpty()
  courseId: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  studentIds: string[];

  @IsBoolean()
  paused: boolean;
}

/**
 * Response for PATCH /bulk/pause
 * See `BulkExamPrepResponse` for the dual-count rationale (Bug 3, 2026-08-01).
 */
export class BulkPauseResponse {
  /** @deprecated Item count, NOT student count. See BulkExamPrepResponse. */
  updatedCount: number;

  /** Distinct student count whose items were mutated. */
  studentsAffected: number;

  /** Raw review-item count mutated (Mongo `modifiedCount`). */
  itemsAffected: number;

  /** Human-readable summary, e.g. "Paused reviews for 3 students.". */
  message: string;
}

/**
 * Body for POST /:studentId/boost
 * Sent by a teacher/admin to force a question to be due immediately
 * for a specific student, optionally resetting the easiness factor.
 *
 * Use cases:
 * - Student bombed an exam → boost all questions from that topic
 * - Re-teach a concept → make it due again today
 * - Set a question to maximum difficulty (targetEF = 1.3)
 */
export class BoostReviewBody {
  @IsString()
  @IsNotEmpty()
  questionId: string;

  /**
   * Optional target easiness factor. If provided, the question's EF is
   * set to this value directly (no SM-2 formula). Use 1.3 for "hardest"
   * or 2.5 for "reset to neutral". If omitted, only next_review_at changes.
   */
  @IsOptional()
  @IsNumber()
  @Min(1.3)
  @Max(3.0)
  targetEF?: number;
}

/**
 * Body for POST /:studentId/reset
 * Sent by a teacher to completely wipe a student's history for a specific card.
 */
export class ResetReviewBody {
  @IsString()
  @IsNotEmpty()
  questionId: string;
}

/**
 * Response for POST /:studentId/reset
 */
export class ResetResponse {
  reset: boolean;
  questionId: string;
  message: string;
}

// ── Route params ───────────────────────────────────────────────────────────

/**
 * Params for routes that only need a studentId.
 * e.g. GET /:studentId/schedule
 */
export class StudentIdParam {
  @IsString()
  @IsNotEmpty()
  studentId: string;
}

/**
 * Params for routes that need both studentId and courseId.
 * e.g. GET /:studentId/course/:courseId
 */
export class StudentCourseParams {
  @IsString()
  @IsNotEmpty()
  studentId: string;

  @IsString()
  @IsNotEmpty()
  courseId: string;
}

// ── Response schemas (for OpenAPI / @ResponseSchema) ──────────────────────

/**
 * Represents a single ReviewItem as returned over HTTP.
 * Mirrors IReviewItem with ObjectId fields serialised to strings.
 */
export class ReviewItemResponse {
  _id: string;
  student_id: string;
  course_id: string;
  question_id: string;
  n: number;
  EF: number;
  interval_days: number;
  next_review_at: Date;
  last_reviewed_at: Date | null;
  notification_opt_out: boolean;
  remediation_hint?: string | null;
}

/**
 * Response for the GET /:studentId/course/:courseId retention endpoint.
 * Includes the computed health summary alongside the raw items.
 */
export class CourseRetentionResponse {
  courseId: string;
  totalItems: number;
  overdueCount: number;
  dueSoonCount: number;
  averageEF: number;
  items: ReviewItemResponse[];
}

/**
 * Response for the POST /:studentId/seed endpoint.
 */
export class SeedScheduleResponse {
  seeded: number;
}

/**
 * Response for the PATCH /:studentId/notifications endpoint.
 */
export class UpdateOptOutResponse {
  updatedCount: number;
}

/**
 * Response for POST /:studentId/boost
 * Returns the updated ReviewItem state after boosting.
 */
export class BoostResponse {
  boosted: boolean;
  questionId: string;
  next_review_at: Date;
  EF: number;
  interval_days: number;
  message: string;
}

// ── Manual Review Assignment (Knob 7, Phase C, 2026-07-21) ───────────────

/**
 * Params for routes scoped to a specific courseId alone.
 * e.g. GET /courses/:courseId/assignable-questions
 */
export class CourseIdParam {
  @IsString()
  @IsNotEmpty()
  courseId: string;
}

/**
 * Route param for `GET /api/spaced-repetition/questions/:questionId/summary`.
 * Added Day 2 (2026-08-04) alongside the new teacher-facing
 * human-readable question summary endpoint.
 */
export class QuestionIdParam {
  @IsString()
  @IsNotEmpty()
  questionId: string;
}

/**
 * Body for POST /:studentId/assign
 * Sent by a teacher to manually put a question on a student's next-review queue.
 */
export class AssignReviewBody {
  @IsString()
  @IsNotEmpty()
  questionId: string;

  @IsString()
  @IsNotEmpty()
  courseId: string;
}

/**
 * One entry in the question picker. Mirrors the service-level shape.
 */
export class AssignableQuestionItem {
  id: string;
  body: string;
  type: string;
  hint: string | null;
  bankIds: string[];
  bankTitles: (string | null)[];
  fromCourse: boolean;
}

/**
 * Response for GET /courses/:courseId/assignable-questions
 */
export class GetAssignableQuestionsResponse {
  courseId: string;
  count: number;
  questions: AssignableQuestionItem[];
}

/**
 * Response for POST /:studentId/assign. The `autoEnabled` flag tells the
 * frontend whether the assignment auto-re-enabled SR for the student (when
 * it had been turned off by a teacher). Distinct from the `item` payload
 * so the toast can surface it independently.
 */
export class AssignReviewResponse {
  item: any; // IReviewItem shape; left `any` to avoid an extra import
  autoEnabled: boolean;
  message: string;
}
