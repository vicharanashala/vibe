import {ID, IQuestionBankRef} from '#root/shared/interfaces/models.js';
import {IQuestionBank} from '#root/shared/interfaces/quiz.js';
import {ObjectId} from 'mongodb';

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

class QuestionBankRef implements IQuestionBankRef {
  bankId: string; // ObjectId as string
  count: number; // How many questions to pick
  difficulty?: string[]; // Optional filter
  tags?: string[]; // Optional filter
  type?: string; // Optional question type filter

  constructor(
    bankId: string,
    count: number,
    difficulty?: string[],
    tags?: string[],
    type?: string,
  ) {
    this.bankId = bankId;
    this.count = count;
    this.difficulty = difficulty;
    this.tags = tags;
    this.type = type;
  }
}

export {QuestionBank, QuestionBankRef};
