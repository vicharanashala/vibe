import {BaseQuestion} from '../../classes/transformers';

export interface QuestionRuleValidator<T extends BaseQuestion = BaseQuestion> {
  validateRules(question: T): void;
}
