import {ID} from '#root/shared/interfaces/models.js';

/**
 * DiscussionThread — a top-level conversation pinned to a single
 * (courseId, cohortId). References the existing User model by ID only;
 * user details are joined in the repository layer, never embedded.
 *
 * `authorFirebaseUid` is denormalised onto the document so the API
 * response can carry it back to the client without a second
 * collection lookup. Optional so the persisted shape stays
 * backwards-compatible with the Milestone A schema.
 */
export interface IDiscussionThread {
  _id?: ID;
  courseId: ID;
  cohortId: ID;
  authorId: ID;
  authorFirebaseUid?: string;
  title: string;
  body: string;
  pinned: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * DiscussionReply — a single reply on a DiscussionThread. References the
 * existing User and DiscussionThread models by ID only.
 *
 * `authorFirebaseUid` is denormalised for the same reason as on
 * DiscussionThread.
 */
export interface IDiscussionReply {
  _id?: ID;
  threadId: ID;
  authorId: ID;
  authorFirebaseUid?: string;
  body: string;
  createdAt: Date;
  updatedAt: Date;
}
