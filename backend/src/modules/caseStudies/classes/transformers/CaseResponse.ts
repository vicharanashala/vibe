import {ObjectId} from 'mongodb';

/**
 * OPEN      = in the review pool, has not yet reached the win threshold.
 * WON       = reached WINS_REQUIRED wins; no longer served to reviewers.
 * WITHDRAWN = flagged as unjudgeable by UNJUDGEABLE_FLAG_THRESHOLD reviewers;
 *             removed from the pool until the author revises and resubmits.
 */
export type CaseResponseStatus = 'OPEN' | 'WON' | 'WITHDRAWN';

/**
 * One participant's response to one case study.
 *
 * `winCount`/`comparisonsSeenCount`/`flagCount` are denormalised onto the
 * document so the pair-selection query can sort "least-served first" and the
 * win/withdraw thresholds can be checked without an aggregation over
 * `caseComparisons`. They are only ever mutated through atomic `$inc`
 * alongside a comparison's pick — see `CaseStudyRepository.applyPickEffects`.
 */
export interface ICaseResponse {
  _id?: ObjectId;
  userId: ObjectId;
  courseVersionId: ObjectId;
  caseStudyId: ObjectId;
  /** The response body as written by the participant, ≤ CASE_STUDY_RESPONSE_MAX_WORDS words. */
  text: string;
  status: CaseResponseStatus;
  /** Times picked as "better" in a valid, non-flagged comparison. */
  winCount: number;
  /** Total times shown in a served pair, win or not — drives least-served-first serving. */
  comparisonsSeenCount: number;
  flagCount: number;
  /**
   * Consecutive substantive verdicts (A/B/BOTH_WEAK) in which this response was
   * NOT picked as the stronger side, reset to 0 the moment it wins. Crossing the
   * course's configured threshold fires a "your response may need revising"
   * notification — see `CaseStudyRepository.applyPickEffects`.
   */
  weakStreak: number;
  createdAt: Date;
  updatedAt: Date;
}

export class CaseResponse implements ICaseResponse {
  _id?: ObjectId;
  userId: ObjectId;
  courseVersionId: ObjectId;
  caseStudyId: ObjectId;
  text: string;
  status: CaseResponseStatus;
  winCount: number;
  comparisonsSeenCount: number;
  flagCount: number;
  weakStreak: number;
  createdAt: Date;
  updatedAt: Date;

  constructor(input: {
    userId: string;
    courseVersionId: string;
    caseStudyId: string;
    text: string;
  }) {
    this.userId = new ObjectId(input.userId);
    this.courseVersionId = new ObjectId(input.courseVersionId);
    this.caseStudyId = new ObjectId(input.caseStudyId);
    this.text = input.text;
    this.status = 'OPEN';
    this.winCount = 0;
    this.comparisonsSeenCount = 0;
    this.flagCount = 0;
    this.weakStreak = 0;
    this.createdAt = new Date();
    this.updatedAt = new Date();
  }
}
