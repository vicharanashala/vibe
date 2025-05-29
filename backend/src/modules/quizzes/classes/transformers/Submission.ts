import {IGradingResult, ISubmission} from 'modules/quizzes/interfaces/grading';

class Submission implements ISubmission {
  _id?: string;
  quizId: string;
  userId: string;
  attemptId: string;
  submittedAt: Date;
  gradingResult?: IGradingResult;

  constructor(quizId: string, userId: string, attemptId: string) {
    this.quizId = quizId;
    this.userId = userId;
    this.attemptId = attemptId;
    this.submittedAt = new Date();
  }
}

export {Submission};
