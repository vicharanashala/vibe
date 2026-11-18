import {UnauthorizedError} from 'routing-controllers';

/**
 * The signed-in user's id as a hex string.
 *
 * `@CurrentUser()` resolves to the raw users document, whose id is `_id`;
 * there is no `id` field. The support chat used to read `user.id`, so
 * `new ObjectId(undefined)` gave every question (and every admin reply) a
 * fresh random owner, and the ownership check behind rating and issue
 * reports refused the learner's own questions with 403. `id` is still
 * accepted in case a caller passes an already-mapped user.
 */
export function currentUserId(user: {_id?: unknown; id?: unknown}): string {
  const id = user?._id ?? user?.id;
  if (!id) {
    throw new UnauthorizedError('No signed-in user');
  }
  return String(id);
}
