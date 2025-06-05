import {QuizItem} from '#root/modules/courses/index.js';
import {BaseQuestion} from '#root/modules/quizzes/classes/transformers/index.js';
import {
  Answer,
  IQuestionAnswerFeedback,
} from '#root/modules/quizzes/interfaces/grading.js';
import {ParameterMap} from '../../tag-parser/index.js';

interface IGrader {
  grade(
    answer: Answer,
    quiz: QuizItem,
    parameterMap?: ParameterMap,
  ): Promise<IQuestionAnswerFeedback>;
}

export {IGrader};
