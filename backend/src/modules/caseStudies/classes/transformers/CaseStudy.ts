import {ObjectId} from 'mongodb';

/**
 * One authored case-study prompt in a course version's bank.
 *
 * This interface intentionally has no answer, rubric, or expected-response
 * field anywhere on it — a case study is scored only by how its responses
 * fare in peer pairwise comparison (see CaseComparison), never against a
 * reference answer. That is a structural property of the schema, not just a
 * convention: there is nowhere on this document to put one.
 *
 * Content is seeded from a version-controlled file
 * (`caseStudies/data/case-studies.seed.json`) via `scripts/seedCaseStudies.ts`
 * — that is the authoring path for this build, not a teacher form. The CRUD
 * endpoints below exist for operational fixes (reordering, corrections), not
 * as the primary way cases get written.
 */
export interface ICaseStudy {
  _id?: ObjectId;
  courseId: ObjectId;
  courseVersionId: ObjectId;
  /** Defines write-unlock order; unique per version, 1-indexed. */
  sequenceIndex: number;
  title: string;
  /** Plain prose prompt — no labelled sections/template. */
  bodyMarkdown: string;
  /** The video item this case follows, if any. Informational only. */
  linkedItemId?: ObjectId;
  isDeleted?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class CaseStudy implements ICaseStudy {
  _id?: ObjectId;
  courseId: ObjectId;
  courseVersionId: ObjectId;
  sequenceIndex: number;
  title: string;
  bodyMarkdown: string;
  linkedItemId?: ObjectId;
  isDeleted?: boolean;
  createdAt: Date;
  updatedAt: Date;

  constructor(input: {
    courseId: string;
    courseVersionId: string;
    sequenceIndex: number;
    title: string;
    bodyMarkdown: string;
    linkedItemId?: string;
  }) {
    this.courseId = new ObjectId(input.courseId);
    this.courseVersionId = new ObjectId(input.courseVersionId);
    this.sequenceIndex = input.sequenceIndex;
    this.title = input.title;
    this.bodyMarkdown = input.bodyMarkdown;
    if (input.linkedItemId) {
      this.linkedItemId = new ObjectId(input.linkedItemId);
    }
    this.isDeleted = false;
    this.createdAt = new Date();
    this.updatedAt = new Date();
  }
}
