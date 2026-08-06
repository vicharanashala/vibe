import {ID, IUser} from '#root/shared/index.js';

// ─── Rubric ────────────────────────────────────────────────────────────────

export interface ICriterionLevel {
  label: string;
  description?: string;
  points: number;
}

export interface ICriterion {
  /** Server-generated at creation time; never supplied by the client. */
  id: string;
  name: string;
  description?: string;
  maxPoints: number;
  /** Reserved for v2 — not used in scoring logic yet. */
  levels?: ICriterionLevel[];
}

export interface IRubric {
  _id?: ID;
  courseId: ID;
  courseVersionId: ID;
  title: string;
  description?: string;
  criteria: ICriterion[];
  createdAt: Date;
  updatedAt?: Date;
}

// ─── Assessment ────────────────────────────────────────────────────────────

export interface IAssessmentCriterionScore {
  criterionId: string;
  points: number;
  feedback?: string;
}

export interface IAssessment {
  _id?: ID;
  submissionId: ID;
  rubricId: ID;
  assessedBy: ID;
  criteria: IAssessmentCriterionScore[];
  /** Computed server-side — sum of awarded points. */
  totalPoints: number;
  /** Computed server-side — sum of rubric's criterion maxPoints at assessment time. */
  maxPoints: number;
  /** Computed server-side — (totalPoints / maxPoints) * 100, rounded to 2dp. */
  percentage: number;
  overallFeedback?: string;
  assessedAt: Date;
  updatedAt?: Date;
}

// ─── Submission ────────────────────────────────────────────────────────────

export interface IProjectSubmission {
  _id?: ID;
  userId: ID;
  projectId: ID;
  courseId: ID;
  courseVersionId: ID;
  submissionURL: string;
  comment?: string;
  createdAt: Date;
  featured?: boolean;
  cohortId?: ID;
}
export interface IProjectSubmissionWithUser {
  course: {name: string};
  courseVersion: {name: string};
  userInfo: Array<
    Partial<IUser> & {
      submissionId: string;
      submissionURL: string;
      comment?: string;
      featured: boolean;
    }
  >;
}
