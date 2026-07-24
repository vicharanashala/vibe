import { injectable } from 'inversify';
import { BaseQuestion } from '../classes/transformers/Question.js';
import { SelectionContext } from '#shared/interfaces/quiz.js';
import { AdaptiveWeightPolicy, CandidateScore } from './AdaptiveWeightPolicy.js';

/**
 * ACRE V2 — Adaptive Question Selector
 *
 * The domain service responsible for choosing which questions to present
 * to a student who is in an active ACRE recovery loop.  It receives a
 * pre-filtered candidate pool and a {@link SelectionContext} and returns
 * the IDs of the selected questions in Bloom-level order.
 *
 * ## Why this class exists
 * The adaptive selection algorithm (scoring → weighted sampling →
 * presentation ordering) is a distinct concern that was previously
 * entangled with coordinator-level logic inside QuestionBankService.
 * Extracting it here makes the algorithm independently testable and
 * keeps QuestionBankService as a thin coordinator.
 *
 * ## Responsibilities
 * - Score every candidate question using {@link AdaptiveWeightPolicy}.
 * - Perform weighted random sampling *without replacement* (roulette-wheel
 *   algorithm) so that questions tagged with failed concepts are selected
 *   with proportionally higher probability.
 * - Apply a repeat-question penalty to de-prioritise questions the student
 *   already saw in their previous attempt without excluding them entirely.
 * - Sort the final selection by Bloom level for deterministic, pedagogically
 *   sensible presentation order.
 * - Emit structured `[ACRE]` diagnostic logs for every selection decision.
 *
 * ## What this class intentionally does NOT do
 * - It does not access the database.
 * - It does not start transactions.
 * - It does not decide whether adaptive mode should activate — that guard
 *   lives in QuestionBankService.
 * - It does not modify the weights based on Bloom level; Bloom is used
 *   only for ordering, never for probability.
 *
 * ## Algorithm — Weighted Sampling Without Replacement (Roulette-Wheel)
 * For each question to select:
 *   1. Sum the weights of all remaining candidates.
 *   2. Draw a uniform random number in [0, totalWeight).
 *   3. Walk the remaining list accumulating weights until the running sum
 *      reaches the drawn number — the candidate at that position is chosen.
 *   4. Remove the chosen candidate from the pool and repeat.
 *
 * This ensures each draw is independent and correct, and that no question
 * can be selected twice.
 */
@injectable()
export class AdaptiveQuestionSelector {
  /**
   * Canonical Bloom's Taxonomy ordering used for presentation sorting.
   * Questions are ordered from lower-order to higher-order thinking skills
   * so students encounter foundational recall before synthesis.
   */
  private static readonly BLOOM_HIERARCHY = [
    'knowledge',
    'understanding',
    'application',
    'analysis',
    'evaluation',
    'creation',
    'unclassified',
  ] as const;

  /**
   * Selects `count` questions from `candidateQuestions` using weighted
   * random sampling without replacement, then returns their IDs sorted by
   * Bloom level for presentation.
   *
   * @param candidateQuestions - All questions in the question bank that are
   *   eligible for this attempt.  Must have at least one element.
   * @param questionTagsMap - Maps each question ID to the set of tags
   *   inherited from its parent question bank(s).  Used to determine
   *   whether a question matches a failed concept tag.
   * @param count - The number of questions to select (from
   *   `questionBankRef.count`).
   * @param selectionContext - The student's ACRE context produced by
   *   {@link AdaptiveSelectionContextBuilder}.  Provides `failedTags` and
   *   `previousQuestionIds`.
   * @returns An array of `count` question ID strings ordered by Bloom level
   *   ascending.  If the pool has fewer candidates than `count`, all
   *   available candidates are returned.
   */
  public select(
    candidateQuestions: BaseQuestion[],
    questionTagsMap: Map<string, Set<string>>,
    count: number,
    selectionContext: SelectionContext,
  ): string[] {
    const failedTags = selectionContext.failedTags ?? [];
    const previousQuestionIds = selectionContext.previousQuestionIds ?? [];

    // Score every candidate and build the pool used for sampling.
    const candidates: CandidateScore[] = candidateQuestions.map(question => {
      const questionId = question._id.toString();
      const questionTags = questionTagsMap.get(questionId) ?? new Set<string>();

      // A question "matches" if at least one of its parent bank's tags
      // overlaps with the set of tags from the student's incorrectly answered
      // questions in their previous attempt.
      const matchedFailedTag = failedTags.some(tag => questionTags.has(tag));
      const repeated = previousQuestionIds.includes(questionId);

      const weight = AdaptiveWeightPolicy.calculate(matchedFailedTag, repeated);

      // Read the Bloom level directly from the document; default to
      // 'unclassified' for questions created before the field existed.
      const bloomLevel =
        (question as any).bloomLevel?.toLowerCase() ?? 'unclassified';

      return { questionId, weight, matchedFailedTag, repeatedQuestion: repeated, bloomLevel };
    });

    // Bloom is a secondary sort key here — it does NOT influence weights.
    const diagnosticOrder = [...candidates].sort((a, b) => {
      if (b.weight !== a.weight) return b.weight - a.weight;
      const idxA = AdaptiveQuestionSelector.BLOOM_HIERARCHY.indexOf(a.bloomLevel as any);
      const idxB = AdaptiveQuestionSelector.BLOOM_HIERARCHY.indexOf(b.bloomLevel as any);
      return idxA - idxB;
    });

    const repeatedIds = candidates
      .filter(c => c.repeatedQuestion)
      .map(c => c.questionId);
    if (repeatedIds.length > 0) {
      console.log('[ACRE] Penalised (repeated) question IDs:', JSON.stringify(repeatedIds));
    }

    // --- Weighted sampling without replacement (roulette-wheel) ---
    const selected: string[] = [];
    const remaining = [...candidates];

    for (let i = 0; i < count; i++) {
      if (remaining.length === 0) break;

      const totalWeight = remaining.reduce((sum, c) => sum + c.weight, 0);

      if (totalWeight === 0) {
        // Degenerate case: all remaining candidates have weight 0 (e.g. every
        // question is repeated AND penalised to 0).  Select the first
        // remaining rather than dropping it, so we always return `count`
        // questions when the pool is large enough.
        selected.push(remaining.splice(0, 1)[0].questionId);
        continue;
      }

      // Draw a random point in [0, totalWeight) and walk the list.
      const draw = Math.random() * totalWeight;
      let accumulated = 0;
      let chosenIndex = remaining.length - 1; // fallback for floating-point edge cases

      for (let j = 0; j < remaining.length; j++) {
        accumulated += remaining[j].weight;
        if (draw <= accumulated) {
          chosenIndex = j;
          break;
        }
      }

      selected.push(remaining.splice(chosenIndex, 1)[0].questionId);
    }

    // Sort the final selection by Bloom level ASC so students encounter
    // lower-order thinking questions before higher-order ones, regardless
    // of the random draw order.
    const selectedOrdered = [...selected].sort((a, b) => {
      const bloomA = candidates.find(c => c.questionId === a)?.bloomLevel ?? 'unclassified';
      const bloomB = candidates.find(c => c.questionId === b)?.bloomLevel ?? 'unclassified';
      const idxA = AdaptiveQuestionSelector.BLOOM_HIERARCHY.indexOf(bloomA as any);
      const idxB = AdaptiveQuestionSelector.BLOOM_HIERARCHY.indexOf(bloomB as any);
      return idxA - idxB;
    });

    console.log('[ACRE] Selected questions (Bloom order):', JSON.stringify(selectedOrdered));

    return selectedOrdered;
  }
}
