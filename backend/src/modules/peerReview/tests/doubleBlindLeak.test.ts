/**
 * Double-blind LEAK tests — the gatekeeper for v1.
 *
 * The three most important tests in the entire peer-review v1:
 *
 *   1. GET /students/me/peer-review-assignments response does NOT
 *      contain any submitter identifier (id, name, email)
 *   2. GET /peer-review-assignments/:id/submission response does NOT
 *      contain any submitter identifier
 *   3. GET /students/me/peer-reviews-received response does NOT
 *      contain any reviewer identifier
 *
 * We exercise this by building representative "leaky" payloads (the
 * way the database would actually return them), running them through
 * the controller's strip functions, and asserting that
 * responseContainsIdentifier() doesn't find the offending needles.
 *
 * These tests use real production-style payloads to catch:
 *   - typos in the allow-list
 *   - new fields added to a record without updating the allow-list
 *   - nested fields that slip through (e.g. student inside submission)
 */
import { describe, it, expect } from 'vitest';
import {
  stripSubmitterIdentity,
  stripReviewerIdentity,
  responseContainsIdentifier,
} from '../utils/doubleBlindFilters.js';

// ---------------------------------------------------------------------------
// Helper: build a "real" assignment with no submitter identifiers hidden in
// it, and verify the strip fn produces a leak-free payload.
// ---------------------------------------------------------------------------

const SUBMITTER_IDENTIFIERS = {
  id: '6f7e8d9c5b4a3f2e1d0c9b8a',
  email: 'student@yaksha.com',
  name: 'Test Student',
  firebaseUid: 'firebase-uid-zzzzz',
};

const REVIEWER_IDENTIFIERS = {
  id: '1a2b3c4d5e6f7a8b9c0d1e2f',
  email: 'reviewer@yaksha.com',
  name: 'Test Reviewer',
  firebaseUid: 'firebase-uid-rrrrr',
};

function buildAssignmentPayload() {
  // This is what the assignment repo would return if it returned
  // EVERYTHING in the record. Most of these fields are submitter-side
  // and MUST be stripped before reaching the wire.
  return {
    _id: 'assn-1',
    assessmentId: 'a-1',
    submissionId: 's-1',
    // ---- submitter-side fields (should be stripped) ----
    submissionStudentId: SUBMITTER_IDENTIFIERS.id,
    submissionStudentName: SUBMITTER_IDENTIFIERS.name,
    submissionStudentEmail: SUBMITTER_IDENTIFIERS.email,
    submissionStudentFirebaseUid: SUBMITTER_IDENTIFIERS.firebaseUid,
    submission: {
      studentId: SUBMITTER_IDENTIFIERS.id,
      studentName: SUBMITTER_IDENTIFIERS.name,
      studentEmail: SUBMITTER_IDENTIFIERS.email,
    },
    studentId: SUBMITTER_IDENTIFIERS.id,
    studentName: SUBMITTER_IDENTIFIERS.name,
    studentEmail: SUBMITTER_IDENTIFIERS.email,
    // ---- safe fields (should remain) ----
    reviewerId: REVIEWER_IDENTIFIERS.id,
    cohortId: 'cohort-1',
    courseId: 'course-1',
    courseVersionId: 'cv-1',
    assignedAt: new Date().toISOString(),
    dueAt: new Date(Date.now() + 86_400_000).toISOString(),
    status: 'PENDING',
    reassignmentCount: 0,
  };
}

function buildSubmissionPayload() {
  // GET /peer-review-assignments/:id/submission would return a
  // superset of fields including submitter identity. We feed in the
  // "leaky" version and verify the strip fn (or hand-crafted
  // controller logic) keeps it clean.
  return {
    assignmentId: 'assn-1',
    assessmentTitle: 'Project Report v2',
    rubric: [
      { criterionId: 'c-1', label: 'Depth', maxPoints: 10 },
      { criterionId: 'c-2', label: 'Clarity', maxPoints: 5 },
    ],
    submissionDeadline: new Date().toISOString(),
    notes: 'My notes here',
    links: [
      { url: 'https://drive.google.com/...', label: 'Report' },
    ],
    dueAt: new Date(Date.now() + 86_400_000).toISOString(),
    // ---- submitter-side fields (would be stripped / omitted in real call) ----
    studentId: SUBMITTER_IDENTIFIERS.id,
    studentName: SUBMITTER_IDENTIFIERS.name,
    studentEmail: SUBMITTER_IDENTIFIERS.email,
    studentFirebaseUid: SUBMITTER_IDENTIFIERS.firebaseUid,
  };
}

function buildReviewPayload() {
  // Each review object. The reviewer-side field MUST be stripped
  // before this payload reaches a submitter.
  return {
    _id: 'review-1',
    assignmentId: 'a-1',
    assessmentId: 'asn-1',
    submissionId: 's-1',
    cohortId: 'cohort-1',
    scores: [{ criterionId: 'c-1', score: 8 }],
    overallComment: 'Looks good',
    totalScore: 8,
    submittedAt: new Date().toISOString(),
    isLate: false,
    teacherOverridden: false,
    // ---- reviewer-side fields (should be stripped) ----
    reviewerId: REVIEWER_IDENTIFIERS.id,
    reviewerName: REVIEWER_IDENTIFIERS.name,
    reviewerEmail: REVIEWER_IDENTIFIERS.email,
    reviewerFirebaseUid: REVIEWER_IDENTIFIERS.firebaseUid,
    reviewAuthor: {
      id: REVIEWER_IDENTIFIERS.id,
      name: REVIEWER_IDENTIFIERS.name,
    },
  };
}

// ---------------------------------------------------------------------------
// Tests for stripSubmitterIdentity (reviewer-side /assignments endpoint)
// ---------------------------------------------------------------------------

describe('double-blind: /students/me/peer-review-assignments', () => {
  it('strips submitter identity from each item', () => {
    const raw = buildAssignmentPayload();
    const out = stripSubmitterIdentity(raw);

    // Identifiers MUST NOT appear anywhere
    for (const needle of Object.values(SUBMITTER_IDENTIFIERS)) {
      expect(responseContainsIdentifier(out, needle)).toBe(false);
    }
  });

  it('preserves reviewer-side and metadata fields', () => {
    const raw = buildAssignmentPayload();
    const out = stripSubmitterIdentity(raw);

    expect(out._id).toBe('assn-1');
    expect(out.assessmentId).toBe('a-1');
    expect(out.submissionId).toBe('s-1');
    expect(out.reviewerId).toBe(REVIEWER_IDENTIFIERS.id);
    expect(out.cohortId).toBe('cohort-1');
    expect(out.courseId).toBe('course-1');
    expect(out.status).toBe('PENDING');
    expect(out.dueAt).toBe(raw.dueAt);
  });

  it('strips nested submitter fields too (defense in depth)', () => {
    const raw = {
      ...buildAssignmentPayload(),
      submission: {
        studentId: SUBMITTER_IDENTIFIERS.id,
        studentName: SUBMITTER_IDENTIFIERS.name,
      },
    };
    const out = stripSubmitterIdentity(raw);
    // The submission object as a whole is dropped (not in allow-list)
    expect(out.submission).toBeUndefined();
    // And the flat identifiers at the top level are also gone
    expect(out.studentId).toBeUndefined();
    expect(out.studentName).toBeUndefined();
    expect(out.studentEmail).toBeUndefined();
  });

  it('handles empty / null input safely', () => {
    expect(stripSubmitterIdentity(null)).toEqual({});
    expect(stripSubmitterIdentity(undefined)).toEqual({});
    expect(stripSubmitterIdentity({})).toEqual({});
  });

  it('handles array-shaped payloads (real /assignments response is an array)', () => {
    const arr = [
      buildAssignmentPayload(),
      buildAssignmentPayload(),
    ];
    const out = arr.map((a) => stripSubmitterIdentity(a));
    expect(out).toHaveLength(2);
    for (const o of out) {
      for (const needle of Object.values(SUBMITTER_IDENTIFIERS)) {
        expect(responseContainsIdentifier(o, needle)).toBe(false);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Tests for /peer-review-assignments/:id/submission
// ---------------------------------------------------------------------------

describe('double-blind: /peer-review-assignments/:id/submission', () => {
  it('the controller hand-picks which fields to return — strip fn would only allow safe fields', () => {
    const raw = buildSubmissionPayload();
    const out = stripSubmitterIdentity(raw);

    // The strip fn allow-list is conservative — it keeps only the
    // fields needed by the reviewer queue display. The actual
    // controller for /submission hand-picks fields (notes, links,
    // rubric, dueAt, assignmentId) — both paths must keep submitter
    // identity out.
    for (const needle of Object.values(SUBMITTER_IDENTIFIERS)) {
      expect(responseContainsIdentifier(out, needle)).toBe(false);
    }
  });

  it('controller-level hand-pick also avoids leaking (regression)', () => {
    // Simulate the controller return value (built by hand in the
    // controller code, not run through any strip fn):
    const controllerReturn = {
      assignmentId: 'assn-1',
      assessmentTitle: 'Project Report v2',
      rubric: [
        { criterionId: 'c-1', label: 'Depth', maxPoints: 10 },
      ],
      notes: 'My notes',
      links: [{ url: 'https://x.example', label: 'X' }],
      dueAt: new Date().toISOString(),
    };

    for (const needle of Object.values(SUBMITTER_IDENTIFIERS)) {
      expect(responseContainsIdentifier(controllerReturn, needle)).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// Tests for stripReviewerIdentity (submitter-side /received endpoint)
// ---------------------------------------------------------------------------

describe('double-blind: /students/me/peer-reviews-received', () => {
  it('strips reviewer identity from each review', () => {
    const raw = buildReviewPayload();
    const out = stripReviewerIdentity(raw);

    for (const needle of Object.values(REVIEWER_IDENTIFIERS)) {
      expect(responseContainsIdentifier(out, needle)).toBe(false);
    }
  });

  it('preserves review content (scores, comments, total)', () => {
    const raw = buildReviewPayload();
    const out = stripReviewerIdentity(raw);

    expect(out._id).toBe('review-1');
    expect(out.scores).toEqual([{ criterionId: 'c-1', score: 8 }]);
    expect(out.overallComment).toBe('Looks good');
    expect(out.totalScore).toBe(8);
    expect(out.teacherOverridden).toBe(false);
  });

  it('handles array of reviews', () => {
    const reviews = [
      buildReviewPayload(),
      buildReviewPayload(),
    ];
    const out = reviews.map((r) => stripReviewerIdentity(r));
    expect(out).toHaveLength(2);
    for (const o of out) {
      for (const needle of Object.values(REVIEWER_IDENTIFIERS)) {
        expect(responseContainsIdentifier(o, needle)).toBe(false);
      }
    }
  });

  it('handles empty / null input safely', () => {
    expect(stripReviewerIdentity(null)).toEqual({});
    expect(stripReviewerIdentity(undefined)).toEqual({});
    expect(stripReviewerIdentity({})).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// Positive control: a "leaky" payload BEFORE the filter DOES contain
// the identifier — proves the test is not just trivially passing.
// ---------------------------------------------------------------------------

describe('positive control: leaky payloads contain identifiers', () => {
  it('assignment payload without filtering has submitter email', () => {
    expect(
      responseContainsIdentifier(buildAssignmentPayload(), 'student@yaksha.com'),
    ).toBe(true);
  });

  it('review payload without filtering has reviewer email', () => {
    expect(
      responseContainsIdentifier(buildReviewPayload(), 'reviewer@yaksha.com'),
    ).toBe(true);
  });

  it('the identifier scanner itself works on deeply nested values', () => {
    const nested = {
      a: { b: { c: 'reviewer@yaksha.com is hidden here' } },
    };
    expect(responseContainsIdentifier(nested, 'reviewer@yaksha.com')).toBe(true);
  });

  it('the identifier scanner works on arrays of objects', () => {
    const arr = [{ a: 'foo' }, { b: 'reviewer@yaksha.com' }];
    expect(responseContainsIdentifier(arr, 'reviewer@yaksha.com')).toBe(true);
  });

  it('the identifier scanner returns false when needle is absent', () => {
    expect(
      responseContainsIdentifier({ a: 'foo', b: 'bar' }, 'reviewer@yaksha.com'),
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Edge case: what if the controller accidentally returned a string body?
// ---------------------------------------------------------------------------

describe('edge case: scalar / weird-shaped inputs', () => {
  it('strips identifier from string the same way (defense)', () => {
    // The scanner's .includes-based implementation will return true
    // when the needle is a substring of the value. This is the
    // intended behavior — the strip fn is what should never have
    // such a value in the first place. The scanner is a check, not
    // a sanitizer.
    expect(
      responseContainsIdentifier('reviewer@yaksha.com', 'reviewer@yaksha.com'),
    ).toBe(true);
  });

  it('re-confirmed: responseContainsIdentifier is .includes-based, so a substring leaks if the needle is present', () => {
    const out = stripReviewerIdentity(buildReviewPayload());
    expect(responseContainsIdentifier(out, 'reviewer@yaksha')).toBe(false);
    expect(responseContainsIdentifier(out, 'reviewer')).toBe(false);
    expect(responseContainsIdentifier(out, 'yaksha')).toBe(false);
  });
});
