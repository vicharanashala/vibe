import {SelectOneInLotValidator} from '../rules/questions/SelectOneInLotValidator';
import {BaseQuestion, SOLQuestion} from '../classes/transformers';
import {BaseQuestionValidator} from '../rules/questions/BaseQuestionValidator';
import {TagParserEngine} from '../rendering/TagParserEngine';

export class QuestionValidationService {
  static resolve(
    question: BaseQuestion,
    tagParserEngine: TagParserEngine,
  ): BaseQuestionValidator {
    switch (question.type) {
      case 'SELECT_ONE_IN_LOT':
        return new SelectOneInLotValidator(
          question as SOLQuestion,
          tagParserEngine,
        );
      // Extend this as needed for other types
      default:
        throw new Error(
          `No validator found for question type: ${question.type}`,
        );
    }
  }
}
