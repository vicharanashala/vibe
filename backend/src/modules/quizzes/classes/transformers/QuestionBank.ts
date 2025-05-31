import {ObjectId} from 'mongodb';
import {ID, IQuestionBank} from 'shared/interfaces/quiz';
import {CreateQuestionBankBody} from '../validators/QuestionBankValidator';

class QuestionBank implements IQuestionBank {
  _id?: string | ObjectId;
  courseId?: string;
  courseVersionId?: string;
  questions: ID[];
  tags?: string[];
  title: string;
  description: string;
  createdAt: Date;
  updatedAt: Date;

  constructor(questionBank: Partial<IQuestionBank>) {
    this._id = questionBank._id ?? new ObjectId();
    this.courseId = questionBank.courseId ?? undefined;
    this.courseVersionId = questionBank.courseVersionId ?? undefined;
    this.questions = questionBank.questions || [];
    this.tags = questionBank.tags || [];
    this.title = questionBank.title;
    this.description = questionBank.description;
    this.createdAt = questionBank.createdAt ?? new Date();
    this.updatedAt = questionBank.updatedAt ?? new Date();
  }
}

export {QuestionBank};
