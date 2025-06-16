import {QuizItem} from '#courses/classes/transformers/Item.js';
import {Answer, IQuestionAnswerFeedback} from '#quizzes/interfaces/grading.js';
import {ParameterMap} from '#quizzes/question-processing/tag-parser/tags/Tag.js';

interface IGrader {
  grade(
    answer: Answer,
    quiz: QuizItem,
    parameterMap?: ParameterMap,
  ): Promise<IQuestionAnswerFeedback>;
}

export {IGrader};
