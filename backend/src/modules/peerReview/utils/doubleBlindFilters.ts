import { ObjectId } from 'mongodb';

/**
 * Double-blind payload filters.
 *
 * Phase 4.2.6 gatekeeper. These functions are the LAST line of defense
 * against identity leaks in the peer-review student-facing endpoints.
 *
 * Two allow-lists:
 *   - stripSubmitterIdentity(obj) — used on every payload sent to a
 *     REVIEWER so they can't see who submitted the work
 *   - stripReviewerIdentity(obj) — used on every payload sent to a
 *     SUBMITTER so they can't see who reviewed their work
 *
 * The allow-lists are the authoritative definition of "safe fields".
 * Adding a field to these lists is a deliberate act — and the unit
 * tests in doubleBlindLeak.test.ts ensure that even a typo in the
 * server response shape can't sneak through.
 */

/**
 * Returns a fresh object containing only fields that are safe to
 * show to the assigned REVIEWER. Specifically excludes everything
 * that could identify the submitter:
 *
 *   - studentId, studentName, studentEmail, studentFirebaseUID
 *   - submission.studentId, submission.studentName
 *   - any nested author / createdBy / owner / user / userId field
 *     on the assignment itself or on the linked submission record
 */
export function stripSubmitterIdentity(obj: any): any {
  // Allowed fields. Adding a new field is a deliberate act.
  const allowed = new Set([
    '_id',
    'assessmentId',
    'submissionId',
    'reviewerId',
    'cohortId',
    'courseId',
    'courseVersionId',
    'assignedAt',
    'dueAt',
    'status',
    'reassignmentCount',
    'submittedReviewId',
    'reassignedToAssignmentId',
    'createdAt',
    'updatedAt',
  ]);
  const out: any = {};
  for (const k of Object.keys(obj || {})) {
    if (allowed.has(k)) {
      const val = obj[k];
      if (val && typeof val === 'object' && (val instanceof ObjectId || val._bsontype === 'ObjectID')) {
        out[k] = val.toString();
      } else {
        out[k] = val;
      }
    }
  }
  return out;
}

/**
 * Returns a fresh object containing only fields that are safe to
 * show to the SUBMITTER when they're looking at the reviews they
 * received. Specifically excludes:
 *
 *   - reviewerId, reviewerName, reviewerEmail, reviewerFirebaseUID
 *   - anything that could de-anonymize the reviewer
 */
export function stripReviewerIdentity(obj: any): any {
  const allowed = new Set([
    '_id',
    'assignmentId',
    'assessmentId',
    'submissionId',
    'cohortId',
    'scores',
    'overallComment',
    'totalScore',
    'submittedAt',
    'isLate',
    'teacherOverridden',
  ]);
  const out: any = {};
  for (const k of Object.keys(obj || {})) {
    if (allowed.has(k)) {
      const val = obj[k];
      if (val && typeof val === 'object' && (val instanceof ObjectId || val._bsontype === 'ObjectID')) {
        out[k] = val.toString();
      } else {
        out[k] = val;
      }
    }
  }
  return out;
}

/**
 * Recursively walks `obj` and returns true if `needle` appears as a
 * value anywhere. Useful for "does this leaked response contain
 * 'student@yaksha.com' anywhere?" checks.
 */
export function responseContainsIdentifier(
  obj: any,
  needle: string,
): boolean {
  if (obj == null) return false;
  if (typeof obj === 'string') return obj.includes(needle);
  if (typeof obj !== 'object') return false;
  if (Array.isArray(obj)) {
    return obj.some((v) => responseContainsIdentifier(v, needle));
  }
  for (const k of Object.keys(obj)) {
    const v = obj[k];
    if (typeof v === 'string' && v.includes(needle)) return true;
    if (responseContainsIdentifier(v, needle)) return true;
  }
  return false;
}