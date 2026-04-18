import {
  IAttempt,
  IQuestionDetails,
  IQuestionAnswer,
} from '#quizzes/interfaces/grading.js';
import {ObjectId} from 'mongodb';

class Attempt implements IAttempt {
  _id?: string | ObjectId;
  quizId: string;
  userId: string | ObjectId;
  questionDetails: IQuestionDetails[]; // List of question IDs in the quiz
  answers?: IQuestionAnswer[];
  createdAt: Date;
  updatedAt: Date;

  constructor(
    quizId: string,
    userId: string | ObjectId,
    questionDetails: IQuestionDetails[],
  ) {
    this.quizId = quizId;
    this.userId = userId;
    this.questionDetails = questionDetails;
    this.createdAt = new Date();
    this.updatedAt = new Date();
  }
}

export {Attempt};
