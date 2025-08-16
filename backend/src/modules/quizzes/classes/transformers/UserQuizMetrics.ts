import {
  IUserQuizMetrics,
  IAttemptDetails,
} from '#quizzes/interfaces/grading.js';
import {ObjectId} from 'mongodb';

class UserQuizMetrics implements IUserQuizMetrics {
  userId: string | ObjectId;
  quizId: string | ObjectId;
  remainingAttempts: number;
  latestAttemptId?: string | ObjectId;
  latestAttemptStatus: 'ATTEMPTED' | 'SUBMITTED' | 'SKIPPED';
  attempts: IAttemptDetails[];
  skipCount: number;

  constructor(userId: string | ObjectId, quizId: string, maxAttempts: number) {
    this.userId = userId;
    this.quizId = quizId;
    this.remainingAttempts = maxAttempts;
    this.latestAttemptStatus = 'ATTEMPTED';
    this.skipCount = 0;
    this.attempts = [];
  }
}

export {UserQuizMetrics};
