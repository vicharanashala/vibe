import {QuestionRuleValidator} from './QuestionRuleValidator';
import {CommonQuestionRules} from './CommonQuestionRules';
import {ParameterizedQuestionRules} from './ParameterizedQuestionRules';
import {SOLQuestion} from '../../classes/transformers';

export class SelectOneInLotValidator
  implements QuestionRuleValidator<SOLQuestion>
{
  validateRules(question: SOLQuestion): void {
    CommonQuestionRules.validate(question);

    if (!question.correctLotItem) {
      throw new Error('Correct option is required.');
    }

    if (!question.incorrectLotItems?.length) {
      throw new Error('At least one incorrect option is required.');
    }

    // Parameterization-specific checks
    if (question.isParameterized) {
      ParameterizedQuestionRules.ensureParameterizedTagPresence(question.text);

      const expressions = ParameterizedQuestionRules.extractNumExprs(
        question.text,
      );
      if (expressions.length) {
        if (!question.parameters?.length) {
          throw new Error('Parameters must be defined if <NumExpr> is used.');
        }
        ParameterizedQuestionRules.validateMathExpressions(
          expressions,
          question.parameters,
        );
      }

      const lotItems = [question.correctLotItem, ...question.incorrectLotItems];
      ParameterizedQuestionRules.checkLotItemsParameterized(lotItems);
    }
  }
}
