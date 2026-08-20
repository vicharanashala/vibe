import {beforeEach, describe, expect, it} from 'vitest';
import {ObjectId} from 'mongodb';
import {CommentService} from '../services/CommentService.js';
import type {IComment} from '../classes/transformers/Comment.js';
import {MAX_COMMENT_LENGTH} from '../constants.js';

const ITEM = new ObjectId().toString();
const VERSION = new ObjectId().toString();

class FakeRepo {
  comments: IComment[] = [];

  async listByItem(itemId: string) {
    return this.comments.filter(c => c.itemId.toString() === itemId);
  }

  async findById(commentId: string) {
    return this.comments.find(c => c._id!.toString() === commentId) ?? null;
  }

  async create(comment: IComment) {
    const _id = new ObjectId();
    this.comments.push({...comment, _id});
    return _id.toString();
  }

  async findAuthors(userIds: string[]) {
    return new Map(userIds.map(id => [id, 'Test User']));
  }
}

/** Stands in for ItemRepository — only ITEM belongs to VERSION. */
class FakeItemRepo {
  async readItem(courseVersionId: string, itemId: string) {
    return courseVersionId === VERSION && itemId === ITEM ? {_id: new ObjectId(itemId)} : null;
  }
}

let repo: FakeRepo;
let service: CommentService;

beforeEach(() => {
  repo = new FakeRepo();
  service = new CommentService(repo as never, new FakeItemRepo() as never);
});

describe('postComment', () => {
  it('rejects an empty comment', async () => {
    await expect(
      service.postComment({userId: new ObjectId().toString(), itemId: ITEM, courseVersionId: VERSION, text: '  '}),
    ).rejects.toThrow(/empty/i);
  });

  it(`rejects a comment over ${MAX_COMMENT_LENGTH} characters`, async () => {
    await expect(
      service.postComment({
        userId: new ObjectId().toString(),
        itemId: ITEM,
        courseVersionId: VERSION,
        text: 'x'.repeat(MAX_COMMENT_LENGTH + 1),
      }),
    ).rejects.toThrow(new RegExp(`${MAX_COMMENT_LENGTH} characters`));
  });

  it('redirects a reply-to-a-reply onto the original top-level comment (caps threading at one level)', async () => {
    const author = new ObjectId().toString();
    const {commentId: topLevel} = await service.postComment({
      userId: author,
      itemId: ITEM,
      courseVersionId: VERSION,
      text: 'top level',
    });
    const {commentId: reply1} = await service.postComment({
      userId: author,
      itemId: ITEM,
      courseVersionId: VERSION,
      text: 'first reply',
      parentCommentId: topLevel,
    });
    const {commentId: reply2} = await service.postComment({
      userId: author,
      itemId: ITEM,
      courseVersionId: VERSION,
      text: 'reply to the reply',
      parentCommentId: reply1,
    });

    const stored = repo.comments.find(c => c._id!.toString() === reply2)!;
    expect(stored.parentCommentId!.toString()).toBe(topLevel);
  });

  it('lists comments visible to everyone, in chronological order', async () => {
    await service.postComment({userId: new ObjectId().toString(), itemId: ITEM, courseVersionId: VERSION, text: 'first'});
    await service.postComment({userId: new ObjectId().toString(), itemId: ITEM, courseVersionId: VERSION, text: 'second'});

    const list = await service.listForItem(VERSION, ITEM);
    expect(list.map(c => c.text)).toEqual(['first', 'second']);
    expect(list[0].authorName).toBe('Test User');
  });
});

describe('item-scoping (IDOR guard)', () => {
  it('rejects posting a comment against an itemId that does not belong to the given course version', async () => {
    const foreignItem = new ObjectId().toString();
    await expect(
      service.postComment({
        userId: new ObjectId().toString(),
        itemId: foreignItem,
        courseVersionId: VERSION,
        text: 'sneaky',
      }),
    ).rejects.toThrow(/not found/i);
  });

  it('rejects listing comments for an itemId that does not belong to the given course version', async () => {
    const foreignItem = new ObjectId().toString();
    await expect(service.listForItem(VERSION, foreignItem)).rejects.toThrow(/not found/i);
  });
});
