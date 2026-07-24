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
  DEFAULT_POLICY,
  MAX_REFLECTION_LENGTH,
  MAX_SCORE,
  MIN_REFLECTION_LENGTH,
  MIN_SCORE,
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
   * Record a student's reflection for a reflection item. One per student per
   * item;
   * a second attempt is rejected rather than silently overwriting, so a
   * reflection that peers have already scored can never change under them.
   */
  async submitReflection(input: {
    userId: string;
    courseId: string;
    courseVersionId: string;
    itemId: string;
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

    const existing = await this.repository.findByUserAndItem(
      input.userId,
      input.itemId,
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
    itemId: string;
  }): Promise<AnonymousReflectionForReview | null> {
    const policy = await this.repository.getPolicy(input.itemId);
    const reviewsCompleted = await this.repository.countReviewsByReviewer(
      input.userId,
      input.itemId,
    );
    // The quota is a hard cap, not a floor: a student reviews exactly the
    // configured number, so the review supply stays spread across the cohort
    // instead of a few keen students draining the pool. A quota of 0 means
    // reciprocity is off and reviewing is not part of this item.
    if (reviewsCompleted >= policy.requiredReviewsToUnlock) {
      return null;
    }
    const reflection = await this.repository.findNextForReview({
      reviewerId: input.userId,
      itemId: input.itemId,
      maxReviewsPerReflection: policy.maxReviewsPerReflection,
    });
    if (!reflection) return null;

    return {
      reflectionId: reflection._id!.toString(),
      text: reflection.text,
      reviewsCompleted,
      reviewsRequired: policy.requiredReviewsToUnlock,
    };
  }

  /**
   * The course/version/item a reflection belongs to, for authorising a review
   * whose request path carries only the reflection id.
   */
  async getReflectionContext(reflectionId: string): Promise<{
    courseId: string;
    courseVersionId: string;
    itemId: string;
  }> {
    const reflection = await this.repository.findById(reflectionId);
    if (!reflection) {
      throw new NotFoundError('Reflection not found.');
    }
    return {
      courseId: reflection.courseId.toString(),
      courseVersionId: reflection.courseVersionId.toString(),
      itemId: reflection.itemId.toString(),
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

    const policy = await this.repository.getPolicy(reflection.itemId.toString());

    // Enforce the quota as a hard cap on the server, so it holds regardless of
    // what the client offers. Checked before the write, so a student can never
    // exceed the number of reviews the instructor set.
    const alreadyDone = await this.repository.countReviewsByReviewer(
      input.reviewerId,
      reflection.itemId.toString(),
    );
    if (alreadyDone >= policy.requiredReviewsToUnlock) {
      throw new BadRequestError(
        'You have completed all the reviews assigned for this reflection.',
      );
    }

    const result = await this.repository.recordReview({
      reflectionId: input.reflectionId,
      reviewerId: input.reviewerId,
      courseVersionId: reflection.courseVersionId.toString(),
      itemId: reflection.itemId.toString(),
      scores: input.scores,
      helpful: input.helpful,
      maxReviewsPerReflection: policy.maxReviewsPerReflection,
    });

    if (result.applied === false) {
      throw new BadRequestError(
        result.reason === 'DUPLICATE'
          ? 'You have already reviewed this reflection.'
          : 'This reflection has already received enough reviews.',
      );
    }

    const reviewsCompleted = await this.repository.countReviewsByReviewer(
      input.reviewerId,
      reflection.itemId.toString(),
    );
    return {
      reviewsCompleted,
      reviewsRequired: policy.requiredReviewsToUnlock,
    };
  }

  /**
   * The author's own reflection plus its score, which stays hidden until they
   * have reviewed their quota of peers (reciprocity) and enough peers have
   * scored them for the average to mean anything.
   */
  async getMyReflection(input: {
    userId: string;
    itemId: string;
  }): Promise<MyReflectionResult | null> {
    const reflection = await this.repository.findByUserAndItem(
      input.userId,
      input.itemId,
    );
    if (!reflection) return null;

    const policy = await this.repository.getPolicy(input.itemId);
    const reviewsCompleted = await this.repository.countReviewsByReviewer(
      input.userId,
      input.itemId,
    );

    const base = {
      reflectionId: reflection._id!.toString(),
      text: reflection.text,
      confidence: reflection.confidence,
      reviewsReceived: reflection.reviewCount,
      reviewsCompleted,
      reviewsRequired: policy.requiredReviewsToUnlock,
      helpfulCount: reflection.helpfulCount,
    };

    if (reviewsCompleted < policy.requiredReviewsToUnlock) {
      return {...base, averageScore: null, lockedReason: 'REVIEWS_PENDING'};
    }
    if (reflection.reviewCount < policy.minReviewsToReveal) {
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
    itemId?: string;
    limit: number;
  }) {
    // A listing may span items with different policies. When it is narrowed to
    // one item that item's threshold applies; across a whole version there is no
    // single correct threshold, so the default stands in.
    const {minReviewsToReveal} = input.itemId
      ? await this.repository.getPolicy(input.itemId)
      : DEFAULT_POLICY;

    const reflections = await this.repository.listByCourseVersion(input);
    const authorIds = reflections.map(r => r.userId.toString());
    const [authors, reviewsGiven] = await Promise.all([
      this.repository.findAuthors(authorIds),
      this.repository.countReviewsByReviewers(authorIds, input.itemId),
    ]);

    return reflections.map(r => {
      const authorId = r.userId.toString();
      // The instructor sees the average whenever one exists. The reveal
      // threshold protects a student from over-reading three opinions about
      // their own work; it is not a reason to withhold the class picture from
      // the person who has to act on it.  carries the caveat.
      const averageScore =
        r.reviewCount > 0
          ? Math.round((r.scoreSum / r.reviewCount) * 100) / 100
          : null;

      return {
        reflectionId: r._id!.toString(),
        userId: authorId,
        studentName: authors.get(authorId)?.name ?? 'Unknown student',
        studentEmail: authors.get(authorId)?.email ?? '',
        itemId: r.itemId.toString(),
        text: r.text,
        confidence: r.confidence,
        reviewsReceived: r.reviewCount,
        reviewsGiven: reviewsGiven.get(authorId) ?? 0,
        helpfulCount: r.helpfulCount,
        averageScore,
        /** True when the average is below the item's reveal threshold. */
        isProvisional: r.reviewCount > 0 && r.reviewCount < minReviewsToReveal,
        /** The gap the instructor acts on: self-rating minus peer average. */
        confidenceGap:
          averageScore !== null
            ? Math.round((r.confidence - averageScore) * 10) / 10
            : null,
        status: r.status,
        createdAt: r.createdAt.toISOString(),
      };
    });
  }

  /** Instructor roll-up: participation and the confidence-versus-peers gap. */
  async getInstructorStats(input: {
    courseVersionId: string;
    itemId?: string;
  }) {
    const {minReviewsToReveal} = input.itemId
      ? await this.repository.getPolicy(input.itemId)
      : DEFAULT_POLICY;
    return this.repository.getStats({...input, minReviewsToReveal});
  }

  private assertInScoreRange(value: number, field: string): void {
    if (!Number.isInteger(value) || value < MIN_SCORE || value > MAX_SCORE) {
      throw new BadRequestError(
        `${field} must be a whole number between ${MIN_SCORE} and ${MAX_SCORE}.`,
      );
    }
  }
}
