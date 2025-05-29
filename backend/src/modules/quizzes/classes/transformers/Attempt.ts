import {
  IAttempt,
  IQuestionDetails,
  IQuestionAnswer,
} from 'modules/quizzes/interfaces/grading';

class Attempt implements IAttempt {
  _id?: string;
  quizId: string;
  userId: string;
  questionDetails: IQuestionDetails[]; // List of question IDs in the quiz
  answers?: IQuestionAnswer[];
  createdAt: Date;
  updatedAt: Date;

  constructor(
    quizId: string,
    userId: string,
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
