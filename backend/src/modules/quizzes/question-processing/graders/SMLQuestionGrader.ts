import {QuizItem} from '#courses/classes/transformers/Item.js';
import {SMLQuestion} from '#quizzes/classes/transformers/Question.js';
import {
  ISMLAnswer,
  IQuestionAnswerFeedback,
} from '#quizzes/interfaces/grading.js';
import {ParameterMap} from '../tag-parser/tags/Tag.js';

import {IGrader} from './interfaces/IGrader.js';

class SMLQuestionGrader implements IGrader {
  constructor(readonly question: SMLQuestion) {}

  async grade(
    answer: ISMLAnswer,
    quiz: QuizItem,
    parameterMap?: ParameterMap,
    selectedAnswerTexts?: string [],
  ): Promise<IQuestionAnswerFeedback> {
    const correctLotItemIds = this.question.correctLotItems.map(item =>
      item._id.toString(),
    );
    
    // to get detailed feedback text
    const appendSelectedTexts = (feedbackBase: string) => {
      if (selectedAnswerTexts?.length) {
        const selectedTextList = selectedAnswerTexts.join(', ');
        return `${feedbackBase} Selected answer(s): ${selectedTextList}.`;
      }
      return feedbackBase;
    };

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

      let feedbackText = `You got ${correctAnswers.length} out of ${correctLotItemIds.length} correct.`;
      feedbackText = appendSelectedTexts(feedbackText);

      const feedback: IQuestionAnswerFeedback = {
        questionId: this.question._id,
        status:
          score > 0
            ? score === this.question.points
              ? 'CORRECT'
              : 'PARTIAL'
            : 'INCORRECT',
        score: score,
        answerFeedback: feedbackText,
      };
      return feedback;
    } else {
      // Full grading logic
      const isCorrect =
        answer.lotItemIds.length === correctLotItemIds.length &&
        answer.lotItemIds.every(id => correctLotItemIds.includes(id));

      let feedbackText = isCorrect
        ? 'Correct answer!'
        : 'Incorrect answer. Please try again.';
      feedbackText = appendSelectedTexts(feedbackText);

      const feedback: IQuestionAnswerFeedback = {
        questionId: this.question._id,
        status: isCorrect ? 'CORRECT' : 'INCORRECT',
        score: isCorrect ? this.question.points : 0,
        answerFeedback: feedbackText,
      };
      return feedback;
    }
  }
}

export {SMLQuestionGrader};
