// Watch Time Track Hook
export interface WatchTimeTrackData {
  rewinds: number;
  fastForwards: number;
  videoId: string;
  userId: string;
  courseId: string;
  versionId: string;
  rewindData: Array<{
    from: string;
    to: string;
    createdAt: string;
  }>;
  fastForwardData: Array<{
    from: string;
    to: string;
    createdAt: string;
  }>;
}

// User Activity Event interface
export interface IUserActivityEvent {
  _id?: string;
  userId: string;
  courseId: string;
  courseVersionId: string;
  videoId: string; // itemId from the system, stored as ObjectId
  rewinds: number;
  fastForwards: number;
  rewindData: Array<{
    from: string; // HH:MM:SS format
    to: string;   // HH:MM:SS format
    createdAt: string;
  }>;
  fastForwardData: Array<{
    from: string; // HH:MM:SS format
    to: string;   // HH:MM:SS format
    createdAt: string;
  }>;
  createdAt: string;
  updatedAt: string;
  isDeleted?: boolean;
  deletedAt?: string;
}