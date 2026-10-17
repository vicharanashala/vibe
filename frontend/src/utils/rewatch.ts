import type { RewatchQuizContext } from '@/types/video.types';

const OBJECT_ID = /^[a-f0-9]{24}$/i;

/**
 * Decides whether a rewatch should be linked to the quiz attempt the learner
 * came from.
 *
 * The link is only kept when the learner was sent back to this very video, and
 * only when both ids are well formed: the rewatch start call validates them,
 * so sending a malformed id would get the whole request rejected and lose the
 * rewatch record for the sake of an optional link.
 */
export function resolveRewatchQuizLink(
  context: RewatchQuizContext | null | undefined,
  itemId: string,
): { quizId: string; attemptId: string } | null {
  if (!context || context.itemId !== itemId) return null;
  if (!OBJECT_ID.test(context.quizId) || !OBJECT_ID.test(context.attemptId)) {
    return null;
  }
  return { quizId: context.quizId, attemptId: context.attemptId };
}
