import {SOLQuestion} from 'modules/quizzes/classes/transformers';
import {IGrader} from './interfaces/IGrader';
import {
  IQuestionAnswerFeedback,
  ISOLAnswer,
} from 'modules/quizzes/interfaces/grading';
import {IQuestion} from 'shared/interfaces/quiz';
import {QuizItem} from 'modules/courses';
import {ParameterMap} from '../tag-parser';

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
