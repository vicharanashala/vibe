import {ObjectId} from 'mongodb';

/**
 * The peer-review record backing one CASE_STUDY course item.
 *
 * Its `_id` is the item's own `_id` (see `CaseStudyRepository.upsertForItem`),
 * so the review runtime keys on the item directly. Content and config are
 * synced from the item on every open; there is no separate authoring form.
 *
 * This interface intentionally has no answer, rubric, or expected-response
 * field anywhere on it — a case study is scored only by how its responses
 * fare in peer pairwise comparison (see CaseComparison), never against a
 * reference answer. That is a structural property of the schema, not just a
 * convention: there is nowhere on this document to put one.
 */
export interface ICaseStudy {
  _id?: ObjectId;
  courseId: ObjectId;
  courseVersionId: ObjectId;
  /** Legacy ordering field; always 0 in the item-type model. */
  sequenceIndex: number;
  title: string;
  /** Plain prose prompt — no labelled sections/template. */
  bodyMarkdown: string;
  /**
   * Per-item review knobs, synced from the CASE_STUDY item's details on every
   * `ensureCaseForItem` so the engine reads them off this doc without an
   * item→version lookup. Undefined falls back to the module constants
   * (WINS_REQUIRED / REVIEWER_MIN_PICKS_PER_CASE / DEFAULT_WEAK_STREAK_THRESHOLD).
   */
  /** Wins a response needs before it leaves the review pool. */
  reviewsRequired?: number;
  /** Comparisons each reviewer is asked to judge (soft floor shown to the learner). */
  picksRequired?: number;
  /** Consecutive losses before the author is nudged to revise (0 disables). */
  weakStreakThreshold?: number;
  /** The video item this case follows, if any. Informational only. */
  linkedItemId?: ObjectId;
  isDeleted?: boolean;
  createdAt: Date;
  updatedAt: Date;
}
