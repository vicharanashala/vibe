import {inject, injectable} from 'inversify';
import {BadRequestError, ForbiddenError, NotFoundError} from 'routing-controllers';
import {COMMENTS_TYPES} from '../types.js';
import {CommentRepository} from '../repositories/providers/mongodb/CommentRepository.js';
import {Comment} from '../classes/transformers/Comment.js';
import {DEFAULT_LIST_LIMIT, MAX_COMMENT_LENGTH} from '../constants.js';
import {COURSES_TYPES} from '../../courses/types.js';
import {ItemRepository} from '#root/shared/database/providers/mongo/repositories/ItemRepository.js';

export interface CommentView {
  commentId: string;
  authorName: string;
  authorUserId: string;
  text: string;
  parentCommentId: string | null;
  createdAt: string;
}

@injectable()
export class CommentService {
  constructor(
    @inject(COMMENTS_TYPES.CommentRepo)
    private readonly repository: CommentRepository,
    @inject(COURSES_TYPES.ItemRepo)
    private readonly itemRepo: ItemRepository,
  ) {}

  /**
   * The CASL check in `CommentController.assertCanAccessItem` only constrains
   * `itemId` when linear progression is on (see `itemAbilities.ts`) — with it
   * off, the ability grants `{courseId, versionId}` with no itemId condition,
   * so any itemId paired with a course version the caller is enrolled in
   * would otherwise pass. This confirms the item actually belongs to that
   * course version before any comment read/write trusts it.
   */
  private async assertItemBelongsToVersion(
    courseVersionId: string,
    itemId: string,
  ): Promise<void> {
    const item = await this.itemRepo.readItem(courseVersionId, itemId);
    if (!item) {
      throw new NotFoundError('Item not found in this course version.');
    }
  }

  /** Flat, chronological — the client groups replies under their parent by parentCommentId. */
  async listForItem(courseVersionId: string, itemId: string): Promise<CommentView[]> {
    await this.assertItemBelongsToVersion(courseVersionId, itemId);
    const comments = await this.repository.listByItem(itemId, DEFAULT_LIST_LIMIT);
    const authors = await this.repository.findAuthors(comments.map(c => c.userId.toString()));
    return comments.map(c => ({
      commentId: c._id!.toString(),
      authorName: authors.get(c.userId.toString()) ?? 'Unknown',
      authorUserId: c.userId.toString(),
      text: c.text,
      parentCommentId: c.parentCommentId ? c.parentCommentId.toString() : null,
      createdAt: c.createdAt.toISOString(),
    }));
  }

  async postComment(input: {
    userId: string;
    itemId: string;
    courseVersionId: string;
    text: string;
    parentCommentId?: string;
  }): Promise<{commentId: string}> {
    await this.assertItemBelongsToVersion(input.courseVersionId, input.itemId);

    const text = input.text.trim();
    if (text.length === 0) {
      throw new BadRequestError('A comment cannot be empty.');
    }
    if (text.length > MAX_COMMENT_LENGTH) {
      throw new BadRequestError(`A comment must be at most ${MAX_COMMENT_LENGTH} characters.`);
    }

    if (input.parentCommentId) {
      const parent = await this.repository.findById(input.parentCommentId);
      if (!parent) {
        throw new BadRequestError('The comment being replied to no longer exists.');
      }
      if (parent.itemId.toString() !== input.itemId) {
        throw new ForbiddenError('That comment belongs to a different item.');
      }
      if (parent.parentCommentId) {
        // Threading is capped at one level (PLANNING.md §6) — a reply to a
        // reply is redirected onto the original top-level comment instead of
        // being rejected, so the UI doesn't need a special error state for it.
        input.parentCommentId = parent.parentCommentId.toString();
      }
    }

    const commentId = await this.repository.create(
      new Comment({
        itemId: input.itemId,
        courseVersionId: input.courseVersionId,
        userId: input.userId,
        text,
        parentCommentId: input.parentCommentId,
      }),
    );
    return {commentId};
  }
}
