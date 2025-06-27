import {QuizItem} from '#courses/classes/transformers/Item.js';
import {SOLQuestion} from '#quizzes/classes/transformers/Question.js';
import {
  ISOLAnswer,
  IQuestionAnswerFeedback,
} from '#quizzes/interfaces/grading.js';
import {ParameterMap} from '../tag-parser/tags/Tag.js';

import {IGrader} from './interfaces/IGrader.js';

class SOLQuestionGrader implements IGrader {
  constructor(readonly question: SOLQuestion) {}
  async grade(
    answer: ISOLAnswer,
    quiz: QuizItem,
    parameterMap?: ParameterMap,
  ): Promise<any> {
    const correctLotItemId = this.question.correctLotItem._id;
    const isCorrect =
      answer.lotItemId.toString() === correctLotItemId.toString();
    const feedback: IQuestionAnswerFeedback = {
      questionId: this.question._id,
      status: isCorrect ? 'CORRECT' : 'INCORRECT',
      score: isCorrect ? this.question.points : 0,
      answerFeedback: isCorrect ? 'Correct answer!' : 'Incorrect answer.',
    };
    return feedback;
  }
}

export {SOLQuestionGrader};
