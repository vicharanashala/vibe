import {QuizItem} from '#courses/classes/transformers/Item.js';
import {OTLQuestion} from '#quizzes/classes/transformers/Question.js';
import {
  IOTLAnswer,
  IQuestionAnswerFeedback,
} from '#quizzes/interfaces/grading.js';
import {IGrader} from './interfaces/IGrader.js';

class OTLQuestionGrader implements IGrader {
  constructor(readonly question: OTLQuestion) {}

  async grade(
    answer: IOTLAnswer,
    quiz: QuizItem,
  ): Promise<IQuestionAnswerFeedback> {
    const total = this.question.ordering.length;
    const correctOrderingMap = new Map(
      this.question.ordering.map(({lotItem, order}) => [
        String(lotItem._id),
        order,
      ]),
    );

    let correctCount = 0;

    for (const userOrder of answer.orders) {
      const correctOrder = correctOrderingMap.get(String(userOrder.lotItemId));
      if (correctOrder !== undefined && correctOrder === userOrder.order) {
        correctCount += 1;
      }
    }

    const scorePerItem = this.question.points / total;
    const score = scorePerItem * correctCount;

    const allCorrect = correctCount === total;

    let status: IQuestionAnswerFeedback['status'];
    if (allCorrect) {
      status = 'CORRECT';
    } else if (quiz.details.allowPartialGrading && correctCount > 0) {
      status = 'PARTIAL';
    } else {
      status = 'INCORRECT';
    }

    return {
      questionId: this.question._id!,
      status,
      score: status === 'INCORRECT' ? 0 : Math.round(score),
      answerFeedback: this.generateFeedback(correctCount, total, status),
    };
  }

  private generateFeedback(
    correct: number,
    total: number,
    status: IQuestionAnswerFeedback['status'],
  ): string | undefined {
    switch (status) {
      case 'CORRECT':
        return 'Great job! You ordered all items correctly.';
      case 'PARTIAL':
        return `You ordered ${correct} out of ${total} items correctly.`;
      case 'INCORRECT':
        return 'None of the items were in the correct order.';
    }
  }
}

export {OTLQuestionGrader};
