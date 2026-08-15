/** How a share-link recipient watches. Mirrors the backend enum. */
export type ShareLinkViewingMode = 'PLAIN' | 'PROCTORED';

export type ShareLinkStatus = 'ACTIVE' | 'OPENED' | 'EXPIRED' | 'REVOKED';

/** Whether the link was mailed to its recipient. */
export type ShareLinkEmailStatus = 'NOT_SENT' | 'SENT' | 'FAILED';

/** Why a pasted YouTube URL cannot be played inside ViBe. */
export type YouTubeEmbedFailure =
  | 'INVALID_URL'
  | 'NOT_FOUND'
  | 'PRIVATE'
  | 'EMBEDDING_DISABLED'
  | 'AGE_OR_REGION_RESTRICTED'
  | 'CHECK_FAILED';

export interface YouTubeValidation {
  embeddable: boolean;
  videoId?: string;
  title?: string;
  reason?: YouTubeEmbedFailure;
  /** Says what is wrong and what to do about it. Safe to show as-is. */
  message?: string;
}

export interface ShareLinkRecipientInput {
  name: string;
  email: string;
}

export interface CreateShareLinksInput {
  recipients: ShareLinkRecipientInput[];
  cohortId?: string;
  itemId?: string;
  expiresInDays?: number;
  viewingMode?: ShareLinkViewingMode;
  /** Email each recipient their own link. */
  sendEmail?: boolean;
}

export interface ShareLink {
  shareLinkId: string;
  recipientName: string;
  recipientEmail: string;
  /** The URL to send to this recipient. One per person. */
  url: string;
  status: ShareLinkStatus;
  viewingMode: ShareLinkViewingMode;
  emailStatus: ShareLinkEmailStatus;
  expiresAt: string;
}

export interface ShareLinkAnalytics {
  shareLinkId: string;
  recipientName: string;
  recipientEmail: string;
  status: ShareLinkStatus;
  openCount: number;
  totalWatchTimeSeconds: number;
  completedItems: number;
  totalItems: number;
  watchedPercent: number;
  rewinds: number;
  fastForwards: number;
  lastSeenAt?: string;
}

/** What opening a share link hands back to the recipient's browser. */
export interface OpenedShareLink {
  /** Exchanged for a Firebase ID token; the recipient never signs up. */
  customToken: string;
  courseId: string;
  courseVersionId: string;
  cohortId?: string;
  itemId?: string;
  recipientName: string;
  viewingMode: ShareLinkViewingMode;
}

export interface QuickShareInput {
  url: string;
  recipients: ShareLinkRecipientInput[];
  /** Where the video ends, HH:MM:SS. Without it only watch time is meaningful. */
  endTime?: string;
  expiresInDays?: number;
  viewingMode?: ShareLinkViewingMode;
  sendEmail?: boolean;
}

export interface QuickShareResult {
  itemId: string;
  videoTitle: string;
  links: ShareLink[];
}
