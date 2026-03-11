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