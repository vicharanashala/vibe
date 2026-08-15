import 'reflect-metadata';
import {ObjectId} from 'mongodb';
import {
  ID,
  IShareLink,
  ShareLinkEmailStatus,
  ShareLinkStatus,
  ShareLinkViewingMode,
} from '#shared/interfaces/models.js';

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
  viewingMode: ShareLinkViewingMode = ShareLinkViewingMode.PLAIN;
  status: ShareLinkStatus = ShareLinkStatus.ACTIVE;
  emailStatus: ShareLinkEmailStatus = ShareLinkEmailStatus.NOT_SENT;
  emailedAt?: Date;
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
    viewingMode?: ShareLinkViewingMode;
  }) {
    this.token = opts.token;
    this.courseId = opts.courseId;
    this.courseVersionId = opts.courseVersionId;
    this.recipientName = opts.recipientName;
    this.recipientEmail = opts.recipientEmail;
    this.createdBy = opts.createdBy;
    this.expiresAt = opts.expiresAt;
    this.viewingMode = opts.viewingMode ?? ShareLinkViewingMode.PLAIN;
    this.createdAt = new Date();

    if (opts.cohortId) {
      this.cohortId = opts.cohortId;
    }
    if (opts.itemId) {
      this.itemId = opts.itemId;
    }
  }
}
