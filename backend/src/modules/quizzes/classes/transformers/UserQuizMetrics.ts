import {
  IUserQuizMetrics,
  IAttemptDetails,
} from '#quizzes/interfaces/grading.js';
import {ObjectId} from 'mongodb';

class UserQuizMetrics implements IUserQuizMetrics {
  userId: string | ObjectId;
  quizId: string;
  remainingAttempts: number;
  latestAttemptId?: string;
  latestAttemptStatus: 'ATTEMPTED' | 'SUBMITTED';
  attempts: IAttemptDetails[];

  constructor(userId: string | ObjectId, quizId: string, maxAttempts: number) {
    this.userId = userId;
    this.quizId = quizId;
    this.remainingAttempts = maxAttempts;
    this.latestAttemptStatus = 'ATTEMPTED';
    this.attempts = [];
  }
}

export {UserQuizMetrics};
