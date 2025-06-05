import {SOLQuestion} from '#root/modules/quizzes/classes/transformers/index.js';
import {IGrader} from './interfaces/IGrader.js';
import {
  IQuestionAnswerFeedback,
  ISOLAnswer,
} from '#root/modules/quizzes/interfaces/grading.js';
import {IQuestion} from '#root/shared/interfaces/quiz.js';
import {QuizItem} from '#root/modules/courses/index.js';
import {ParameterMap} from '../tag-parser/index.js';

class SOLQuestionGrader implements IGrader {
  constructor(readonly question: SOLQuestion) {}
  async grade(
    answer: ISOLAnswer,
    quiz: QuizItem,
    parameterMap?: ParameterMap,
  ): Promise<any> {
    const correctLotItemId = this.question.correctLotItem._id;
    const isCorrect = answer.lotItemId === correctLotItemId;
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
