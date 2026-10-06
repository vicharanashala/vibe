import {ClientSession} from 'mongodb';
import {ID} from '#root/shared/interfaces/models.js';
import {IDiscussionThread} from '../repositories/model.js';

/**
 * Repository contract for DiscussionThread persistence.
 *
 * `cohortFilter` is always expressed as a Mongo fragment rather than a
 * concrete cohortId list, so callers cannot widen the read by passing
 * different values from the controller. The service builds it from the
 * caller's authenticated cohort scope.
 */
export interface IDiscussionThreadRepository {
  /**
   * List threads for a course, filtered by the caller's cohort scope.
   * `cohortFilter` is a Mongo filter fragment (`{cohortId: {$in: [...]}}`
   * or `{}` for unrestricted callers). Result is sorted pinned-first,
   * then newest-first.
   */
  listByCourse(
    courseId: string,
    cohortFilter: Record<string, unknown>,
    session?: ClientSession,
  ): Promise<IDiscussionThread[]>;

  /**
   * Fetch a single thread by ID. Returns null when not found.
   */
  findById(
    threadId: string,
    session?: ClientSession,
  ): Promise<IDiscussionThread | null>;

  /**
   * Insert a new thread. Returns the inserted document.
   */
  create(
    thread: IDiscussionThread,
    session?: ClientSession,
  ): Promise<IDiscussionThread>;

  /**
   * Update title/body and/or the `pinned` flag on an existing thread.
   * Returns the updated document, or null if no thread matched the ID.
   *
   * `pinned` is only set by the Milestone C `PATCH /discussions/:threadId/pin`
   * endpoint; `title` / `body` are only set by the Milestone A edit path.
   * The repo treats all fields as optional, so a partial update is fine.
   */
  update(
    threadId: string,
    data: {title?: string; body?: string; pinned?: boolean},
    session?: ClientSession,
  ): Promise<IDiscussionThread | null>;

  /**
   * Hard-delete a thread (and its replies — enforced by caller/cleanup,
   * not by cascade triggers). Returns true when a thread was deleted.
   */
  deleteById(
    threadId: string,
    session?: ClientSession,
  ): Promise<boolean>;
}
