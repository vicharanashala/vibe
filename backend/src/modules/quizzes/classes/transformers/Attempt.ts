import {
  IAttempt,
  IQuestionDetails,
  IQuestionAnswer,
} from '#quizzes/interfaces/grading.js';
import { ID } from '#root/shared/index.js';
import {ObjectId} from 'mongodb';

class Attempt implements IAttempt {
  _id?: string | ObjectId;
  quizId: string | ObjectId;
  userId: string | ObjectId;
  questionDetails: IQuestionDetails[]; // List of question IDs in the quiz
  answers?: IQuestionAnswer[];
  createdAt: Date;
  updatedAt: Date;
  cohortId?: ID;

  constructor(
    quizId: string | ObjectId,
    userId: string | ObjectId,
    questionDetails: IQuestionDetails[],
    cohortId?: ID,
  ) {
    this.quizId = quizId;
    this.userId = userId;
    this.questionDetails = questionDetails;
    if (cohortId) {
      this.cohortId = cohortId;
    }
    this.createdAt = new Date();
    this.updatedAt = new Date();
  }
}

export {Attempt};
