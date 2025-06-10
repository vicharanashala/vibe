import {QuizItem} from '#courses/index.js';
import {Answer, IQuestionAnswerFeedback} from '#quizzes/interfaces/grading.js';
import {ParameterMap} from '#quizzes/question-processing/tag-parser/index.js';

interface IGrader {
  grade(
    answer: Answer,
    quiz: QuizItem,
    parameterMap?: ParameterMap,
  ): Promise<IQuestionAnswerFeedback>;
}

export {IGrader};
