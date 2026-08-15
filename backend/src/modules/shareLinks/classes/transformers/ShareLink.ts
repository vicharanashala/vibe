import 'reflect-metadata';
import {ObjectId} from 'mongodb';
import {ID, IShareLink, ShareLinkStatus} from '#shared/interfaces/models.js';

/**
 * A share link as persisted. The token is generated here so that no caller can
 * supply one, and the expiry is always set — a link without one would outlive
 * the sharer's intent.
 *
 * @category ShareLinks/Transformers
 */
export class ShareLink implements IShareLink {
  _id?: ID;
  token: string;
  courseId: ID;
  courseVersionId: ID;
  cohortId?: ID;
  itemId?: ID;
  recipientName: string;
  recipientEmail: string;
  createdBy: ID;
  guestUserId?: ID;
  status: ShareLinkStatus = ShareLinkStatus.ACTIVE;
  openCount = 0;
  createdAt: Date;
  expiresAt: Date;
  firstOpenedAt?: Date;
  lastOpenedAt?: Date;
  revokedAt?: Date;

  constructor(opts: {
    token: string;
    courseId: ObjectId;
    courseVersionId: ObjectId;
    cohortId?: ObjectId;
    itemId?: ObjectId;
    recipientName: string;
    recipientEmail: string;
    createdBy: ObjectId;
    expiresAt: Date;
  }) {
    this.token = opts.token;
    this.courseId = opts.courseId;
    this.courseVersionId = opts.courseVersionId;
    this.recipientName = opts.recipientName;
    this.recipientEmail = opts.recipientEmail;
    this.createdBy = opts.createdBy;
    this.expiresAt = opts.expiresAt;
    this.createdAt = new Date();

    if (opts.cohortId) {
      this.cohortId = opts.cohortId;
    }
    if (opts.itemId) {
      this.itemId = opts.itemId;
    }
  }
}
