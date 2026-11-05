import {ObjectId} from 'mongodb';

export type CaseComparisonOutcome = 'A' | 'B' | 'BOTH_WEAK' | 'FLAGGED';

/**
 * One pair served to one reviewer for one case, and its outcome once picked.
 *
 * `responseAId`/`responseBId` are always stored in sorted-id order (not
 * "first served" order) so the unique `(reviewerId, responseAId, responseBId)`
 * index catches a pair regardless of which response the reviewer saw on the
 * left — `sideAIsLeft` carries the actual display placement separately.
 *
 * `servedAt`/`minimumScreenTimeSeconds` are the server-anchored timer: the
 * client never supplies its own elapsed time, and re-requesting "next pair"
 * while this row is still undecided (`outcome` unset) re-serves the same row
 * with these two fields unchanged. That is what makes leaving and returning
 * restart the visible countdown without letting a page refresh reset the
 * server clock.
 */
export interface ICaseComparison {
  _id?: ObjectId;
  caseStudyId: ObjectId;
  courseVersionId: ObjectId;
  reviewerId: ObjectId;
  responseAId: ObjectId;
  responseBId: ObjectId;
  /** Randomised placement, recorded for audit; never re-randomised on re-serve. */
  sideAIsLeft: boolean;
  servedAt: Date;
  minimumScreenTimeSeconds: number;
  outcome?: CaseComparisonOutcome;
  decidedAt?: Date;
  createdAt: Date;
}
