import {BaseQuestion} from 'modules/quizzes/classes/transformers';

interface IQuestionRenderStrategy {
  render<T extends BaseQuestion>(question: T): T;
}

export {IQuestionRenderStrategy};
