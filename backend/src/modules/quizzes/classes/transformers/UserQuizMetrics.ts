import {
  IUserQuizMetrics,
  IAttemptDetails,
} from '#quizzes/interfaces/grading.js';
import { ID } from '#root/shared/index.js';
import {ObjectId} from 'mongodb';

class UserQuizMetrics implements IUserQuizMetrics {
  userId: string | ObjectId;
  quizId: string | ObjectId;
  remainingAttempts: number;
  latestAttemptId?: string | ObjectId;
  latestAttemptStatus: 'ATTEMPTED' | 'SUBMITTED' | 'SKIPPED';
  attempts: IAttemptDetails[];
  skipCount: number;
  cohortId?: ID;

  constructor(userId: string | ObjectId, quizId: string | ObjectId, maxAttempts: number, cohortId?: ID) {
    this.userId = userId;
    this.quizId = quizId;
    this.remainingAttempts = maxAttempts;
    this.latestAttemptStatus = 'ATTEMPTED';
    this.skipCount = 0;
    this.attempts = [];
    if (cohortId) {
      this.cohortId = cohortId;
    }
  }
}

export {UserQuizMetrics};
