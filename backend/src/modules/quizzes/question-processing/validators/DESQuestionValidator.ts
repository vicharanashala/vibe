import {DESQuestion} from '#quizzes/classes/transformers/Question.js';
import {TagParser} from '../tag-parser/TagParser.js';
import {BaseQuestionValidator} from './BaseQuestionValidator.js';

export class DESQuestionValidator extends BaseQuestionValidator {
  declare question: DESQuestion;
  declare tagParserEngine: TagParser;

  constructor(question: DESQuestion, tagParserEngine: TagParser) {
    super(question, tagParserEngine);
  }

  validate(): void {
    super.validate();
    if (this.question.isParameterized) {
      // Validate tags in question text
      if (this.tagParserEngine.isAnyValidTagPresent(this.question.text)) {
        this.tagParserEngine.validateTags(
          this.question.text,
          this.question.parameters,
        );
      }
      // Validate tags in hint
      if (
        this.question.hint &&
        this.tagParserEngine.isAnyValidTagPresent(this.question.hint)
      ) {
        this.tagParserEngine.validateTags(
          this.question.hint,
          this.question.parameters,
        );
      }
      // Validate tags in solutionText
      if (
        this.question.solutionText &&
        this.tagParserEngine.isAnyValidTagPresent(this.question.solutionText)
      ) {
        this.tagParserEngine.validateTags(
          this.question.solutionText,
          this.question.parameters,
        );
      }
    }
  }
}
