import {inject, injectable} from 'inversify';
import {STUDENT_QUESTION_TYPES} from '../../types.js';
import {StudentQuestionRepository} from '../../repositories/providers/mongodb/StudentQuestionRepository.js';
import {ItemRepository} from '#root/shared/database/providers/mongo/repositories/ItemRepository.js';
import {COURSES_TYPES} from '../../../courses/types.js';
import {screeningConfig} from '#root/config/screening.js';

/**
 * Supplies the lesson "context" string fed to the screening on-topic and
 * answer-correctness checks, built from the best source available for a segment.
 *
 * Layered, cheapest-safe first, always fail-open (returns null rather than
 * throwing so a submission is never blocked on missing context):
 *
 *   1. Precomputed transcript — a `segmentContext` row populated by the
 *      transcript backfill (the real lesson content, best fidelity).
 *   2. Proxy — the video item's title/description plus the stems of the
 *      following quiz's existing (graded) questions, which approximate what the
 *      lesson covers. Requires no transcript infra, so it works today.
 *   3. Nothing → null. ScreeningService then skips the on-topic check and runs
 *      answer-correctness on model knowledge.
 *
 * The graded stems are passed in by the caller (createQuestion already fetches
 * them for dedup) so we never issue a second question-bank read here.
 */
@injectable()
export class SegmentContextProvider {
  constructor(
    @inject(STUDENT_QUESTION_TYPES.StudentQuestionRepo)
    private readonly repository: StudentQuestionRepository,
    @inject(COURSES_TYPES.ItemRepo)
    private readonly itemRepo: ItemRepository,
  ) {}

  async getContext(input: {
    segmentId: string;
    courseVersionId?: string;
    gradedStems?: string[];
  }): Promise<string | null> {
    const parts: string[] = [];

    // Video title + description — always cheap, from the item itself.
    try {
      const item: any = await this.itemRepo.readItemById(input.segmentId);
      const title = typeof item?.name === 'string' ? item.name.trim() : '';
      const description =
        typeof item?.description === 'string' ? item.description.trim() : '';
      if (title) parts.push(`Lesson: ${title}`);
      if (description) parts.push(description);
    } catch {
      // ignore — title/description are optional
    }

    // Layer 1: precomputed transcript (best fidelity).
    const transcript = await this.repository
      .getSegmentContextText(input.segmentId)
      .catch(() => null);

    if (transcript) {
      parts.push('Lesson transcript:');
      parts.push(transcript);
    } else if (input.gradedStems && input.gradedStems.length > 0) {
      // Layer 2: proxy — the lesson's existing quiz questions approximate its
      // subject matter well enough for a relevance judgement.
      parts.push('Topics covered in this lesson (from its quiz questions):');
      parts.push(
        input.gradedStems
          .slice(0, 20)
          .map(s => `- ${s}`)
          .join('\n'),
      );
    }

    const text = parts.join('\n').slice(0, screeningConfig.contextCharBudget).trim();
    return text || null;
  }
}
