import {ObjectId} from 'mongodb';

/**
 * One post in an item's comment thread. `parentCommentId` set means this is
 * a reply — replies may not themselves be replied to (enforced in
 * CommentService, not the schema), keeping threading to one level per
 * PLANNING.md §6's "no nested infinite threading" cut.
 */
export interface IComment {
  _id?: ObjectId;
  itemId: ObjectId;
  courseVersionId: ObjectId;
  userId: ObjectId;
  text: string;
  parentCommentId?: ObjectId;
  isDeleted?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class Comment implements IComment {
  _id?: ObjectId;
  itemId: ObjectId;
  courseVersionId: ObjectId;
  userId: ObjectId;
  text: string;
  parentCommentId?: ObjectId;
  isDeleted?: boolean;
  createdAt: Date;
  updatedAt: Date;

  constructor(input: {
    itemId: string;
    courseVersionId: string;
    userId: string;
    text: string;
    parentCommentId?: string;
  }) {
    this.itemId = new ObjectId(input.itemId);
    this.courseVersionId = new ObjectId(input.courseVersionId);
    this.userId = new ObjectId(input.userId);
    this.text = input.text;
    if (input.parentCommentId) {
      this.parentCommentId = new ObjectId(input.parentCommentId);
    }
    this.isDeleted = false;
    this.createdAt = new Date();
    this.updatedAt = new Date();
  }
}
