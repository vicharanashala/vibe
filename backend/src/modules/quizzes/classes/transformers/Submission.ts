import {IGradingResult, ISubmission} from 'modules/quizzes/interfaces/grading';
import {ObjectId} from 'mongodb';
class Submission implements ISubmission {
  _id?: string | ObjectId;
  quizId: string;
  userId: string | ObjectId;
  attemptId: string;
  submittedAt: Date;
  gradingResult?: IGradingResult;

  constructor(quizId: string, userId: string | ObjectId, attemptId: string) {
    this.quizId = quizId;
    this.userId = userId;
    this.attemptId = attemptId;
    this.submittedAt = new Date();
  }
}

export {Submission};
