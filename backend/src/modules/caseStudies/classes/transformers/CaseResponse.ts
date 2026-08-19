import {ObjectId} from 'mongodb';

/**
 * OPEN      = in the review pool, has not yet reached the win threshold.
 * WON       = reached WINS_REQUIRED wins; no longer served to reviewers.
 * WITHDRAWN = flagged as unjudgeable by UNJUDGEABLE_FLAG_THRESHOLD reviewers;
 *             removed from the pool until the author revises and resubmits.
 */
export type CaseResponseStatus = 'OPEN' | 'WON' | 'WITHDRAWN';

/**
 * One participant's response to one case study — structured as six elements
 * (FR-12). Only `steelman` (element 2a) is exposed to peer reviewers; the
 * remaining fields inform the author's own reflection and are stored but not
 * shared with anyone else.
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
  /** Element 1a — what the participant thought going in (~1 sentence). */
  beat1a: string;
  /** Element 1b — what challenged that position, or what gave most pause (~1 sentence). */
  beat1b: string;
  /** Element 1c — where the participant ended up (~1 sentence). */
  beat1c: string;
  /** Element 2a — strongest case against where they landed (≥ 25 words). Shown to reviewers. */
  steelman: string;
  /** Element 2b — one perspective from the room; never shown to reviewers. */
  roomPerspective: string;
  /** Element 3 — one thing to change; must answer the cost named in steelman (~1 sentence). */
  changeCommitment: string;
  /** ISO date string from the Zoom session declaration gate (YYYY-MM-DD). Not validated server-side. */
  zoomSessionDate?: string;
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
  beat1a: string;
  beat1b: string;
  beat1c: string;
  steelman: string;
  roomPerspective: string;
  changeCommitment: string;
  zoomSessionDate?: string;
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
    beat1a: string;
    beat1b: string;
    beat1c: string;
    steelman: string;
    roomPerspective: string;
    changeCommitment: string;
    zoomSessionDate?: string;
  }) {
    this.userId = new ObjectId(input.userId);
    this.courseVersionId = new ObjectId(input.courseVersionId);
    this.caseStudyId = new ObjectId(input.caseStudyId);
    this.beat1a = input.beat1a;
    this.beat1b = input.beat1b;
    this.beat1c = input.beat1c;
    this.steelman = input.steelman;
    this.roomPerspective = input.roomPerspective;
    this.changeCommitment = input.changeCommitment;
    if (input.zoomSessionDate) this.zoomSessionDate = input.zoomSessionDate;
    this.status = 'OPEN';
    this.winCount = 0;
    this.comparisonsSeenCount = 0;
    this.flagCount = 0;
    this.weakStreak = 0;
    this.createdAt = new Date();
    this.updatedAt = new Date();
  }
}
