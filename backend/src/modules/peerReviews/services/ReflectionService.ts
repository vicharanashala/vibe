import {inject, injectable} from 'inversify';
import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
} from 'routing-controllers';
import {PEER_REVIEW_TYPES} from '../types.js';
import {ReflectionRepository} from '../repositories/providers/mongodb/ReflectionRepository.js';
import {
  IReflectionScores,
  Reflection,
} from '../classes/transformers/Reflection.js';
import {
  MAX_REFLECTION_LENGTH,
  MAX_SCORE,
  MIN_REFLECTION_LENGTH,
  MIN_REVIEWS_TO_REVEAL,
  MIN_SCORE,
  REQUIRED_REVIEWS_TO_UNLOCK,
} from '../constants.js';

/**
 * A reflection as shown to a reviewing peer.
 *
 * This shape is the anonymity boundary: it is built field by field rather than
 * spread from the document, so a new author-identifying field added upstream
 * can never leak into a review payload by default.
 */
export interface AnonymousReflectionForReview {
  reflectionId: string;
  text: string;
  /** Position in this reviewer's own quota, e.g. 3 of 10. */
  reviewsCompleted: number;
  reviewsRequired: number;
}

/** The author's view of their own reflection and its score. */
export interface MyReflectionResult {
  reflectionId: string;
  text: string;
  confidence: number;
  reviewsReceived: number;
  /** Reviews this student has completed towards unlocking their score. */
  reviewsCompleted: number;
  reviewsRequired: number;
  /** Null whenever the score is withheld; `lockedReason` says why. */
  averageScore: number | null;
  helpfulCount: number;
  lockedReason?: 'REVIEWS_PENDING' | 'AWAITING_PEERS';
}

@injectable()
export class ReflectionService {
  constructor(
    @inject(PEER_REVIEW_TYPES.ReflectionRepo)
    private readonly repository: ReflectionRepository,
  ) {}

  /**
   * Record a student's reflection for a section. One per student per section;
   * a second attempt is rejected rather than silently overwriting, so a
   * reflection that peers have already scored can never change under them.
   */
  async submitReflection(input: {
    userId: string;
    courseId: string;
    courseVersionId: string;
    moduleId: string;
    sectionId: string;
    text: string;
    confidence: number;
  }): Promise<{reflectionId: string}> {
    const text = input.text.trim();
    if (text.length < MIN_REFLECTION_LENGTH) {
      throw new BadRequestError(
        `A reflection must be at least ${MIN_REFLECTION_LENGTH} characters.`,
      );
    }
    if (text.length > MAX_REFLECTION_LENGTH) {
      throw new BadRequestError(
        `A reflection must be at most ${MAX_REFLECTION_LENGTH} characters.`,
      );
    }
    this.assertInScoreRange(input.confidence, 'confidence');

    const existing = await this.repository.findByUserAndSection(
      input.userId,
      input.sectionId,
    );
    if (existing) {
      throw new BadRequestError(
        'You have already submitted a reflection for this section.',
      );
    }

    const reflectionId = await this.repository.create(
      new Reflection({...input, text}),
    );
    return {reflectionId};
  }

  /**
   * Next peer reflection for this user to review, or null when the section's
   * pool holds nothing they can still score.
   */
  async getNextForReview(input: {
    userId: string;
    sectionId: string;
  }): Promise<AnonymousReflectionForReview | null> {
    const reviewsCompleted = await this.repository.countReviewsByReviewer(
      input.userId,
      input.sectionId,
    );
    const reflection = await this.repository.findNextForReview({
      reviewerId: input.userId,
      sectionId: input.sectionId,
    });
    if (!reflection) return null;

    return {
      reflectionId: reflection._id!.toString(),
      text: reflection.text,
      reviewsCompleted,
      reviewsRequired: REQUIRED_REVIEWS_TO_UNLOCK,
    };
  }

  /**
   * Score a peer's reflection. Rejects self-review and double-review; a
   * reflection that hit its cap between being served and being submitted is
   * reported as such so the client can simply fetch the next one.
   */
  async submitReview(input: {
    reviewerId: string;
    reflectionId: string;
    scores: IReflectionScores;
    helpful: boolean;
  }): Promise<{reviewsCompleted: number; reviewsRequired: number}> {
    this.assertInScoreRange(input.scores.understanding, 'understanding');
    this.assertInScoreRange(input.scores.depth, 'depth');
    this.assertInScoreRange(input.scores.clarity, 'clarity');

    const reflection = await this.repository.findById(input.reflectionId);
    if (!reflection) {
      throw new NotFoundError('Reflection not found.');
    }
    if (reflection.userId.toString() === input.reviewerId) {
      throw new ForbiddenError('You cannot review your own reflection.');
    }

    const result = await this.repository.recordReview({
      reflectionId: input.reflectionId,
      reviewerId: input.reviewerId,
      courseVersionId: reflection.courseVersionId.toString(),
      sectionId: reflection.sectionId.toString(),
      scores: input.scores,
      helpful: input.helpful,
    });

    if (!result.applied) {
      throw new BadRequestError(
        result.reason === 'DUPLICATE'
          ? 'You have already reviewed this reflection.'
          : 'This reflection has already received enough reviews.',
      );
    }

    const reviewsCompleted = await this.repository.countReviewsByReviewer(
      input.reviewerId,
      reflection.sectionId.toString(),
    );
    return {reviewsCompleted, reviewsRequired: REQUIRED_REVIEWS_TO_UNLOCK};
  }

  /**
   * The author's own reflection plus its score, which stays hidden until they
   * have reviewed their quota of peers (reciprocity) and enough peers have
   * scored them for the average to mean anything.
   */
  async getMyReflection(input: {
    userId: string;
    sectionId: string;
  }): Promise<MyReflectionResult | null> {
    const reflection = await this.repository.findByUserAndSection(
      input.userId,
      input.sectionId,
    );
    if (!reflection) return null;

    const reviewsCompleted = await this.repository.countReviewsByReviewer(
      input.userId,
      input.sectionId,
    );

    const base = {
      reflectionId: reflection._id!.toString(),
      text: reflection.text,
      confidence: reflection.confidence,
      reviewsReceived: reflection.reviewCount,
      reviewsCompleted,
      reviewsRequired: REQUIRED_REVIEWS_TO_UNLOCK,
      helpfulCount: reflection.helpfulCount,
    };

    if (reviewsCompleted < REQUIRED_REVIEWS_TO_UNLOCK) {
      return {...base, averageScore: null, lockedReason: 'REVIEWS_PENDING'};
    }
    if (reflection.reviewCount < MIN_REVIEWS_TO_REVEAL) {
      return {...base, averageScore: null, lockedReason: 'AWAITING_PEERS'};
    }

    return {
      ...base,
      averageScore:
        Math.round((reflection.scoreSum / reflection.reviewCount) * 100) / 100,
    };
  }

  /** Instructor listing: every reflection in a course version, with its score. */
  async listForInstructor(input: {
    courseVersionId: string;
    sectionId?: string;
    limit: number;
  }) {
    const reflections = await this.repository.listByCourseVersion(input);
    return reflections.map(r => ({
      reflectionId: r._id!.toString(),
      userId: r.userId.toString(),
      sectionId: r.sectionId.toString(),
      text: r.text,
      confidence: r.confidence,
      reviewsReceived: r.reviewCount,
      helpfulCount: r.helpfulCount,
      averageScore:
        r.reviewCount >= MIN_REVIEWS_TO_REVEAL
          ? Math.round((r.scoreSum / r.reviewCount) * 100) / 100
          : null,
      status: r.status,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  /** Instructor roll-up: participation and the confidence-versus-peers gap. */
  async getInstructorStats(input: {
    courseVersionId: string;
    sectionId?: string;
  }) {
    return this.repository.getStats({
      ...input,
      minReviewsToReveal: MIN_REVIEWS_TO_REVEAL,
    });
  }

  private assertInScoreRange(value: number, field: string): void {
    if (!Number.isInteger(value) || value < MIN_SCORE || value > MAX_SCORE) {
      throw new BadRequestError(
        `${field} must be a whole number between ${MIN_SCORE} and ${MAX_SCORE}.`,
      );
    }
  }
}
