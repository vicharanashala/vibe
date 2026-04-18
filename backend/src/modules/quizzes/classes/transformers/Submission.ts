import {
  ISubmission,
  IGradingResult,
  IQuestionAnswer,
  IQuestionAnswerFeedback,
} from '#quizzes/interfaces/grading.js';
import {
  ObjectIdToString,
  StringToObjectId,
} from '#root/shared/constants/transformerConstants.js';
import {Expose, Transform} from 'class-transformer';
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

class QuestionAnswerFeedback implements IQuestionAnswerFeedback {
  @Expose()
  @Transform(ObjectIdToString.transformer, {toPlainOnly: true}) // Convert ObjectId -> string when serializing
  @Transform(StringToObjectId.transformer, {toClassOnly: true}) // Convert string -> ObjectId when deserializing
  questionId: string | ObjectId;

  status: 'CORRECT' | 'INCORRECT' | 'PARTIAL';
  score: number;
  answerFeedback?: string; // Optional feedback for the answer

  constructor({
    questionId,
    status,
    score,
    answerFeedback,
  }: {
    questionId: string | ObjectId;
    status: 'CORRECT' | 'INCORRECT' | 'PARTIAL';
    score: number;
    answerFeedback?: string;
  }) {
    this.questionId = questionId;
    this.status = status;
    this.score = score;
    this.answerFeedback = answerFeedback;
  }
}

export {Submission, QuestionAnswerFeedback};
