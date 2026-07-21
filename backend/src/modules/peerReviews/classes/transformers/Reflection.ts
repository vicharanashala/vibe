import {ObjectId} from 'mongodb';

/**
 * The three rubric criteria a peer scores a reflection on, each 1-10.
 * Kept as a nested object (rather than three flat fields) so a future rubric
 * change is a shape change in one place instead of a migration per criterion.
 */
export interface IReflectionScores {
  /** Did the author actually grasp the concept? */
  understanding: number;
  /** Surface-level summary versus genuine insight or inference. */
  depth: number;
  /** Is the explanation readable and well expressed? */
  clarity: number;
}

/**
 * OPEN      = accepting peer reviews.
 * CLOSED    = reached MAX_REVIEWS_PER_REFLECTION; no longer served to reviewers.
 * WITHDRAWN = author or instructor pulled it from the pool.
 */
export type ReflectionStatus = 'OPEN' | 'CLOSED' | 'WITHDRAWN';

/**
 * One student's written reflection for one section.
 *
 * Review aggregates (`reviewCount`, `scoreSum`, `helpfulCount`) are denormalised
 * onto the document so the serving query can sort by "fewest reviews first" and
 * the reveal check can run without an aggregation over the reviews collection.
 * They are only ever mutated through atomic `$inc` alongside the review insert.
 */
export interface IReflection {
  _id?: ObjectId;
  userId: ObjectId;
  courseId: ObjectId;
  courseVersionId: ObjectId;
  moduleId: ObjectId;
  sectionId: ObjectId;
  /** The reflection body as written by the student. */
  text: string;
  /**
   * The author's self-rating of how well they understood the section, 1-10.
   * Compared against the peer average to surface over- and under-confidence,
   * which is the signal instructors act on.
   */
  confidence: number;
  status: ReflectionStatus;
  /** Number of peer reviews received (0 to MAX_REVIEWS_PER_REFLECTION). */
  reviewCount: number;
  /**
   * Running sum of each review's mean-of-three-criteria. The displayed average
   * is `scoreSum / reviewCount`; storing the sum keeps the update a pure $inc.
   */
  scoreSum: number;
  /** How many reviewers marked this reflection as having helped them. */
  helpfulCount: number;
  createdAt: Date;
  updatedAt: Date;
  isDeleted?: boolean;
  deletedAt?: Date;
}

/**
 * One peer's anonymous review of one reflection.
 *
 * `sectionId` is denormalised from the reflection so that counting a reviewer's
 * completed reviews for a section — the check that unlocks their own score — is
 * a single indexed count instead of a join.
 */
export interface IReflectionReview {
  _id?: ObjectId;
  reflectionId: ObjectId;
  reviewerId: ObjectId;
  courseVersionId: ObjectId;
  sectionId: ObjectId;
  scores: IReflectionScores;
  /** Mean of the three criteria, precomputed at write time. */
  averageScore: number;
  /**
   * "This helped me understand it better" — deliberately separate from the
   * rubric score, so a rough-but-illuminating explanation can be recognised
   * without inflating its grade.
   */
  helpful: boolean;
  createdAt: Date;
}

export class Reflection implements IReflection {
  _id?: ObjectId;
  userId: ObjectId;
  courseId: ObjectId;
  courseVersionId: ObjectId;
  moduleId: ObjectId;
  sectionId: ObjectId;
  text: string;
  confidence: number;
  status: ReflectionStatus;
  reviewCount: number;
  scoreSum: number;
  helpfulCount: number;
  createdAt: Date;
  updatedAt: Date;
  isDeleted?: boolean;

  constructor(input: {
    userId: string;
    courseId: string;
    courseVersionId: string;
    moduleId: string;
    sectionId: string;
    text: string;
    confidence: number;
  }) {
    this.userId = new ObjectId(input.userId);
    this.courseId = new ObjectId(input.courseId);
    this.courseVersionId = new ObjectId(input.courseVersionId);
    this.moduleId = new ObjectId(input.moduleId);
    this.sectionId = new ObjectId(input.sectionId);
    this.text = input.text;
    this.confidence = input.confidence;
    this.status = 'OPEN';
    this.reviewCount = 0;
    this.scoreSum = 0;
    this.helpfulCount = 0;
    this.createdAt = new Date();
    this.updatedAt = new Date();
    this.isDeleted = false;
  }
}

/** Mean of the three rubric criteria, rounded to two decimals. */
export function averageOfScores(scores: IReflectionScores): number {
  const mean = (scores.understanding + scores.depth + scores.clarity) / 3;
  return Math.round(mean * 100) / 100;
}
