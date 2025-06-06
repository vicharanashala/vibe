import {OTLQuestion} from '#quizzes/classes/index.js';
import {ILotItem} from '#shared/index.js';
import {TagParser} from '../tag-parser/TagParser.js';
import {BaseQuestionValidator} from './BaseQuestionValidator.js';

export class OTLQuestionValidator extends BaseQuestionValidator {
  declare tagStatus: {
    questionHasTag?: boolean;
    hintHasTag?: boolean;
    lotItemsWithTag?: boolean[];
    anyLotItemHasTag?: boolean;
    anyLotItemExplainationHasTag?: boolean;
  };
  declare question: OTLQuestion;
  declare tagParserEngine: TagParser;
  lotItems: ILotItem[];

  constructor(question: OTLQuestion, tagParserEngine: TagParser) {
    super(question, tagParserEngine);

    if (question.isParameterized) {
      // Extract lot items from ordering
      this.lotItems = question.ordering.map(order => order.lotItem);
      this.tagStatus.anyLotItemHasTag = this.lotItems.some(item =>
        tagParserEngine.isAnyValidTagPresent(item.text),
      );
      this.tagStatus.anyLotItemExplainationHasTag = this.lotItems.some(item =>
        tagParserEngine.isAnyValidTagPresent(item.explaination),
      );
      this.tagStatus.lotItemsWithTag = this.lotItems.map(
        item =>
          tagParserEngine.isAnyValidTagPresent(item.text) ||
          tagParserEngine.isAnyValidTagPresent(item.explaination),
      );
    }
  }

  validate(): void {
    super.validate();
    // Parameterization-specific checks
    if (this.question.isParameterized) {
      if (!this.tagStatus.anyLotItemHasTag) {
        throw new Error('At least one LotItem must contain a valid tag.');
      } else {
        this.tagStatus.lotItemsWithTag?.forEach((hasTag, index) => {
          const item = this.lotItems[index];
          if (this.tagParserEngine.isAnyValidTagPresent(item.text)) {
            this.tagParserEngine.validateTags(
              item.text,
              this.question.parameters,
            );
          }
          if (this.tagParserEngine.isAnyValidTagPresent(item.explaination)) {
            this.tagParserEngine.validateTags(
              item.explaination,
              this.question.parameters,
            );
          }
        });
      }

      if (this.tagStatus.hintHasTag) {
        this.tagParserEngine.validateTags(
          this.question.hint,
          this.question.parameters,
        );
      }
    }
  }
}
