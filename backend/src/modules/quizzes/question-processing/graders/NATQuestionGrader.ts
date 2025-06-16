import {QuizItem} from '#courses/classes/transformers/Item.js';
import {NATQuestion} from '#quizzes/classes/transformers/Question.js';
import {
  INATAnswer,
  IQuestionAnswerFeedback,
} from '#quizzes/interfaces/grading.js';
import {IGrader} from './interfaces/IGrader.js';
import {evaluate} from 'mathjs';

class NATQuestionGrader implements IGrader {
  constructor(readonly question: NATQuestion) {}

  async grade(
    answer: INATAnswer,
    quiz: QuizItem,
    parameterMap?: Record<string, string | number>,
  ): Promise<IQuestionAnswerFeedback> {
    const expectedValue = this.computeExpectedValue(parameterMap);

    if (expectedValue === null) {
      throw new Error('Cannot compute expected value for NAT question.');
    }

    const roundedAnswer = this.round(
      answer.value,
      this.question.decimalPrecision,
    );
    const lowerBound = expectedValue - this.question.lowerLimit;
    const upperBound = expectedValue + this.question.upperLimit;

    const isCorrect =
      roundedAnswer >= lowerBound && roundedAnswer <= upperBound;

    return {
      questionId: this.question._id!,
      status: isCorrect ? 'CORRECT' : 'INCORRECT',
      score: isCorrect ? this.question.points : 0,
      answerFeedback: isCorrect
        ? 'Correct answer.'
        : `Incorrect. Expected a value between ${this.round(expectedValue, this.question.decimalPrecision) - this.question.lowerLimit} and ${this.round(expectedValue, this.question.decimalPrecision) + this.question.upperLimit}.`,
    };
  }

  private computeExpectedValue(
    parameterMap?: Record<string, string | number>,
  ): number | null {
    if (this.question.expression) {
      try {
        return this.round(
          evaluate(this.question.expression, parameterMap || {}),
          this.question.decimalPrecision,
        );
      } catch (err) {
        console.error('Expression evaluation error:', err);
        return null;
      }
    } else if (typeof this.question.value === 'number') {
      return this.round(this.question.value, this.question.decimalPrecision);
    } else {
      return null;
    }
  }

  private round(value: number, precision: number): number {
    const factor = Math.pow(10, precision);
    return Math.round(value * factor) / factor;
  }
}

export {NATQuestionGrader};
