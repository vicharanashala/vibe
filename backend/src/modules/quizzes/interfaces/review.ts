/**
 * Review-session screen types.
 *
 * These types power the spaced-repetition review UI — a student-facing,
 * read-only view of a question. The answer (correct option, explanation,
 * ordering sequence) is NEVER exposed.
 *
 * @category Quizzes
 */

/** A single multiple-choice option displayed to the student in the review screen. */
export interface ReviewOption {
  /** Letter key: 'A' | 'B' | 'C' | 'D' ... */
  key: string;
  /** Option display text */
  text: string;
}

/**
 * Unified question shape returned by `GET /quizzes/questions/:questionId/review`.
 *
 * All five question types (SOL / SML / OTL / NAT / DES) are normalised to this
 * shape so the frontend review card can render them uniformly.
 *
 * `quizTitle` and `quizId` are best-effort metadata: a question can live in
 * multiple QuestionBanks, each referenced by multiple Quizzes. We resolve the
 * "first" quiz that references a question bank containing this question. The
 * fields are nullable because (a) the question may be orphaned (no quiz links
 * to it yet), or (b) a future question type may not belong to any quiz. When
 * null, the frontend gracefully degrades the attribution line.
 */
export interface ReviewQuestionResponse {
  id: string;
  body: string;
  type: string;
  hint?: string;
  options: ReviewOption[];
  isParameterized: boolean;
  /** Parent quiz title, or null if no quiz references this question. */
  quizTitle: string | null;
  /** Parent quiz id (ObjectId string), or null if no quiz references this question. */
  quizId: string | null;
}