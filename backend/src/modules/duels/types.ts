import { ObjectId } from 'mongodb';

export type DuelStatus = 'PENDING' | 'READY' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'EXPIRED';
export type MatchType = 'FRIEND' | 'INVITE_LINK' | 'MATCHMAKING';
export type ResolutionReason = 'NORMAL' | 'WALKOVER' | 'MUTUAL_NO_SHOW' | 'DRAW';

export type MatchmakingStatus = 'WAITING' | 'MATCHED' | 'CANCELLED';

export interface IDuelMatchmakingQueue {
  _id?: ObjectId | string;
  userId: string;
  courseId: string;
  moduleId?: string | null;
  completionPercentage: number;
  status: MatchmakingStatus;
  queuedAt: Date;
  matchedDuelId?: string | null;
  expiresAt: Date;
}

export interface IDuelSubmission {
  userId: string;
  answer: any;
  submittedAt: Date;
  isCorrect: boolean;
  responseTimeMs: number;
}

export interface IDuelRound {
  roundNumber: number;
  isSuddenDeath: boolean;
  questionId: string;
  revealedAt?: Date;
  submissions: IDuelSubmission[];
  winnerUserId?: string | null;
}

export interface IDuelPlayer {
  userId: string;
  joinedAt?: Date;
}

export interface IDuel {
  _id?: ObjectId | string;
  courseId: string;
  moduleId?: string | null;
  status: DuelStatus;
  matchType: MatchType;
  roundCount: number;
  scheduledFor?: Date | null;
  createdBy: string;
  players: IDuelPlayer[];
  inviteToken?: string | null;
  rounds: IDuelRound[];
  winnerUserId?: string | null;
  resolutionReason?: ResolutionReason | null;
  pointsAwarded?: number;
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date;
}

export const DUELS_TYPES = {
  DuelRepository: Symbol.for('DuelRepository'),
  DuelService: Symbol.for('DuelService'),
};
