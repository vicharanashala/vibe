import {QuizItem} from 'modules/courses';
import {BaseQuestion} from 'modules/quizzes/classes/transformers';
import {
  Answer,
  IQuestionAnswerFeedback,
} from 'modules/quizzes/interfaces/grading';
import {ParameterMap} from '../../tag-parser';

interface IGrader {
  grade(
    answer: Answer,
    quiz: QuizItem,
    parameterMap?: ParameterMap,
  ): Promise<IQuestionAnswerFeedback>;
}

export {IGrader};
