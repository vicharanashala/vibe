/**
 * Test factories for peer-review docs. Each factory returns a fully-formed
 * object with sane defaults; tests override only the fields they care about.
 *
 * _id fields are generated as 24-char hex strings to match Mongo's ObjectId
 * shape without forcing tests to import the mongodb driver just to construct
 * one. Repositories handle `id as any` casts internally.
 *
 * IDs that are links between collections (e.g. assessmentId, submissionId)
 * default to placeholders that tests usually want to override anyway.
 */
import {
  IPeerReviewAssessment,
  IPeerReviewSubmission,
  IPeerReviewAssignment,
  IPeerReviewReview,
} from '#shared/interfaces/models.js';
import { ObjectId } from 'mongodb';

// 24-char hex strings (valid ObjectId shape, not actual ObjectIds)
const id = (suffix?: string) => {
  const s = suffix ?? 'abcdef0123456789abcdef01';
  return s.length === 24 ? s : (s + '0'.repeat(24)).slice(0, 24);
};

const now = () => new Date();
const futureDate = (daysFromNow: number) =>
  new Date(Date.now() + daysFromNow * 24 * 60 * 60 * 1000);
const pastDate = (daysAgo: number) =>
  new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);

export function makeAssessment(
  overrides?: Partial<IPeerReviewAssessment>,
): IPeerReviewAssessment {
  const base: IPeerReviewAssessment = {
    courseId: id('course') as any,
    courseVersionId: id('ver') as any,
    moduleId: id('mod') as any,
    sectionId: id('sec') as any,
    itemId: id('item') as any,
    title: 'Peer-Review Assessment',
    description: 'A test assessment',
    instructorAttachments: [],
    rubric: [
      {
        criterionId: id('crit'),
        label: 'Code Quality',
        description: 'How clean is the code?',
        maxPoints: 25,
      },
      {
        criterionId: id('crit'),
        label: 'Functionality',
        maxPoints: 50,
      },
      {
        criterionId: id('crit'),
        label: 'Documentation',
        maxPoints: 15,
      },
      {
        criterionId: id('crit'),
        label: 'Creativity',
        maxPoints: 10,
      },
    ],
    totalMaxPoints: 100,
    submissionDeadline: futureDate(7),
    reviewDeadline: futureDate(14),
    config: {
      reviewsPerSubmission: 3,
      reviewsPerReviewer: 3,
      antiCollusionMode: 'circular-shift-collision-check',
      latePolicy: 'penalty-only',
      latePenaltyPercent: 10,
      teacherManualReviewEnabled: true,
      notificationsEnabled: true,
      reviewWindowDays: 7,
    },
    cohortId: id('coh') as any,
    createdBy: id('teacher') as any,
    createdAt: now(),
    updatedAt: now(),
    isDeleted: false,
  };
  return { ...base, ...overrides };
}

export function makeSubmission(
  overrides?: Partial<IPeerReviewSubmission>,
): IPeerReviewSubmission {
  const base: IPeerReviewSubmission = {
    assessmentId: id('assess') as any,
    studentId: id('student') as any,
    cohortId: id('coh') as any,
    courseId: id('course') as any,
    courseVersionId: id('ver') as any,
    notes: 'My submission',
    links: [
      {
        url: 'https://drive.google.com/file/d/abc123/view',
        label: 'Project Report',
        kind: 'drive',
        lastAccessible: true,
      },
    ],
    submittedAt: now(),
    isLate: false,
    attachmentsAccessibilityChecked: true,
    reviewAssignmentIds: [],
    reviewsCompleted: 0,
    reviewsTotal: 3,
    teacherOverridden: false,
    createdAt: now(),
    updatedAt: now(),
  };
  return { ...base, ...overrides };
}

export function makeAssignment(
  overrides?: Partial<IPeerReviewAssignment>,
): IPeerReviewAssignment {
  const base: IPeerReviewAssignment = {
    assessmentId: id('assess') as any,
    submissionId: id('sub') as any,
    reviewerId: id('reviewer') as any,
    cohortId: id('coh') as any,
    courseId: id('course') as any,
    courseVersionId: id('ver') as any,
    assignedAt: now(),
    dueAt: futureDate(7),
    status: 'PENDING',
    reassignmentCount: 0,
    createdAt: now(),
    updatedAt: now(),
  };
  return { ...base, ...overrides };
}

export function makeReview(
  overrides?: Partial<IPeerReviewReview>,
): IPeerReviewReview {
  const base: IPeerReviewReview = {
    assignmentId: id('asgn') as any,
    assessmentId: id('assess') as any,
    submissionId: id('sub') as any,
    reviewerId: id('reviewer') as any,
    cohortId: id('coh') as any,
    scores: [
      { criterionId: id('crit1'), score: 18, maxPoints: 25, comment: 'solid' },
      { criterionId: id('crit2'), score: 38, maxPoints: 50, comment: 'works' },
      { criterionId: id('crit3'), score: 12, maxPoints: 15, comment: 'ok' },
      { criterionId: id('crit4'), score: 7, maxPoints: 10, comment: 'good' },
    ],
    overallComment: 'Nice work',
    totalScore: 75,
    submittedAt: now(),
    isLate: false,
    teacherOverridden: false,
  };
  return { ...base, ...overrides };
}

// Helpers for tests that need 5 fake student ObjectIds
export function makeStudentIds(n: number): string[] {
  return Array.from({ length: n }, (_, i) => id(`stu${i}`));
}

// Helper for "in the past" / "in the future" deadlines
export const timeOffset = {
  past: pastDate,
  future: futureDate,
};
