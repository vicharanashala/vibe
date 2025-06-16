import {NATQuestion} from '#quizzes/classes/transformers/Question.js';
import {TagParser} from '../tag-parser/TagParser.js';
import {BaseQuestionValidator} from './BaseQuestionValidator.js';

export class NATQuestionValidator extends BaseQuestionValidator {
  declare question: NATQuestion;
  declare tagParserEngine: TagParser;

  constructor(question: NATQuestion, tagParserEngine: TagParser) {
    super(question, tagParserEngine);
  }

  validate(): void {
    super.validate();
    // Parameterization-specific checks
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
      // Validate tags in expression (answer)
      if (
        this.question.expression &&
        this.tagParserEngine.isAnyValidTagPresent(this.question.expression)
      ) {
        this.tagParserEngine.validateTags(
          this.question.expression,
          this.question.parameters,
        );
      }
    }
  }
}
