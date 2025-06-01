import {NATQuestion} from 'modules/quizzes/classes';
import {IGrader} from './interfaces/IGrader';
import {QuizItem} from 'modules/courses';
import {
  Answer,
  INATAnswer,
  IQuestionAnswerFeedback,
} from 'modules/quizzes/interfaces/grading';
import {ParameterMap} from '../tag-parser';

import {evaluate} from 'mathjs';
import {ObjectId} from 'mongodb';

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
        : `Incorrect. Expected a value near ${expectedValue} ± ${this.question.upperLimit}`,
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
