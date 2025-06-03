import {
  IAttemptDetails,
  IUserQuizMetrics,
} from 'modules/quizzes/interfaces/grading';

class UserQuizMetrics implements IUserQuizMetrics {
  userId: string;
  quizId: string;
  remainingAttempts: number;
  latestAttemptId?: string;
  latestAttemptStatus: 'ATTEMPTED' | 'SUBMITTED';
  attempts: IAttemptDetails[];

  constructor(userId: string, quizId: string, maxAttempts: number) {
    this.userId = userId;
    this.quizId = quizId;
    this.remainingAttempts = maxAttempts;
    this.latestAttemptStatus = 'ATTEMPTED';
    this.attempts = [];
  }
}

export {UserQuizMetrics};
