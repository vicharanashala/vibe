import {QuizItem} from '#courses/index.js';
import {SMLQuestion} from '#quizzes/classes/index.js';
import {
  ISMLAnswer,
  IQuestionAnswerFeedback,
} from '#quizzes/interfaces/grading.js';
import {ObjectId} from 'mongodb';
import {ParameterMap} from '../tag-parser/index.js';
import {IGrader} from './interfaces/IGrader.js';

class SMLQuestionGrader implements IGrader {
  constructor(readonly question: SMLQuestion) {}

  async grade(
    answer: ISMLAnswer,
    quiz: QuizItem,
    parameterMap?: ParameterMap,
  ): Promise<IQuestionAnswerFeedback> {
    const correctLotItemIds = this.question.correctLotItems.map(item =>
      item._id.toString(),
    );
    if (quiz.details.allowPartialGrading) {
      // Partial grading logic
      const correctAnswers = answer.lotItemIds.filter(id =>
        correctLotItemIds.includes(id),
      );
      const incorrectAnswers = answer.lotItemIds.filter(
        id => !correctLotItemIds.includes(id),
      );

      const score =
        (correctAnswers.length / correctLotItemIds.length) *
        this.question.points;
      const feedback: IQuestionAnswerFeedback = {
        questionId: this.question._id,
        status:
          score > 0
            ? score === this.question.points
              ? 'CORRECT'
              : 'PARTIAL'
            : 'INCORRECT',
        score: score,
        answerFeedback: `You got ${correctAnswers.length} out of ${correctLotItemIds.length} correct.`,
      };
      return feedback;
    } else {
      // Full grading logic
      const isCorrect =
        answer.lotItemIds.length === correctLotItemIds.length &&
        answer.lotItemIds.every(id => correctLotItemIds.includes(id));
      const feedback: IQuestionAnswerFeedback = {
        questionId: this.question._id,
        status: isCorrect ? 'CORRECT' : 'INCORRECT',
        score: isCorrect ? this.question.points : 0,
        answerFeedback: isCorrect
          ? 'Correct answer!'
          : 'Incorrect answer. Please try again.',
      };
      return feedback;
    }
  }
}

export {SMLQuestionGrader};
