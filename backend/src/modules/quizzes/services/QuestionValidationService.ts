import {SelectOneInLotValidator} from '../rules/questions/SelectOneInLotValidator';
import {QuestionRuleValidator} from '../rules/questions/QuestionRuleValidator';
import {BaseQuestion} from '../classes/transformers';

export class QuestionValidationService {
  static resolve(question: BaseQuestion): QuestionRuleValidator {
    switch (question.type) {
      case 'SELECT_ONE_IN_LOT':
        return new SelectOneInLotValidator();
      // Extend this as needed for other types
      default:
        throw new Error(
          `No validator found for question type: ${question.type}`,
        );
    }
  }
}
