import {QuizItem} from '#courses/classes/transformers/Item.js';
import {DESQuestion} from '#quizzes/classes/transformers/Question.js';
import {
  IDESAnswer,
  IQuestionAnswerFeedback,
} from '#quizzes/interfaces/grading.js';
import {ParameterMap} from '../tag-parser/tags/Tag.js';

import {IGrader} from './interfaces/IGrader.js';

class DESQuestionGrader implements IGrader {
  constructor(readonly question: DESQuestion) {}

  async grade(
    answer: IDESAnswer,
    quiz: QuizItem,
    parameterMap?: ParameterMap,
  ): Promise<IQuestionAnswerFeedback> {
    const result = await this.evaluateAnswerWithLLM(
      answer.answerText,
      this.question.solutionText,
    );

    return {
      questionId: this.question._id!,
      status: result.status,
      score: result.score,
      answerFeedback: result.feedback,
    };
  }

  /**
   * Placeholder for LLM-based grading.
   * Replace this logic with a call to your LLM service in the future.
   */
  private async evaluateAnswerWithLLM(
    answerText: string,
    solutionText: string,
  ): Promise<{
    status: 'CORRECT' | 'PARTIAL' | 'INCORRECT';
    score: number;
    feedback?: string;
  }> {
    // TODO: Integrate with LLM-based evaluation engine later
    // This is a dummy placeholder response
    return {
      status: 'PARTIAL',
      score: Math.round(this.question.points / 2), // temporary arbitrary logic
      feedback: 'Your answer was partially correct. LLM evaluation pending.',
    };
  }
}

export {DESQuestionGrader};
