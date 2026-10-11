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
  /**
 * Placeholder for LLM-based grading.
 * Replace this logic with a call to your LLM service in the future.
 * Until LLM grading is integrated, descriptive answers are marked PARTIAL
 * with 0 score so students are not incorrectly rewarded or penalised.
 */
  private async evaluateAnswerWithLLM(
    answerText: string,
    solutionText: string,
  ): Promise<{...}> {
    // TODO: Integrate with LLM-based evaluation engine later
    return {
      status: 'INCORRECT',
      score: 0, // award 0 until real LLM grading is in place — no arbitrary points
      feedback: 'Your answer has been recorded and is pending manual or AI review.',
      };
    }
}

export {DESQuestionGrader};
