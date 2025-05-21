import {i} from 'mathjs';
import {BaseQuestion} from 'modules/quizzes/classes/transformers';
import {TagParserEngine} from 'modules/quizzes/rendering/TagParserEngine';

export class BaseQuestionValidator {
  tagStatus: {
    questionHasTag?: boolean;
    hintHasTag?: boolean;
  } = {};

  question: BaseQuestion;
  tagParserEngine: TagParserEngine;

  constructor(question: BaseQuestion, tagParserEngine: TagParserEngine) {
    this.question = question;
    this.tagParserEngine = tagParserEngine;

    if (question.isParameterized) {
      this.tagStatus.questionHasTag = tagParserEngine.isAnyValidTagPresent(
        question.text,
      );
      this.tagStatus.hintHasTag = tagParserEngine.isAnyValidTagPresent(
        question.hint,
      );
    }
  }

  validate(): void {
    if (
      this.question.isParameterized &&
      this.question.parameters.length !== 0
    ) {
      if (!this.tagStatus.questionHasTag) {
        throw new Error(
          'Parameterized question must have a valid tag in the question text.',
        );
      }

      if (this.tagStatus.questionHasTag) {
        this.tagParserEngine.validateTags(
          this.question.text,
          this.question.parameters,
        );
      }

      if (this.tagStatus.hintHasTag) {
        this.tagParserEngine.validateTags(
          this.question.hint,
          this.question.parameters,
        );
      }
    }

    if (
      !this.question.isParameterized &&
      this.question.parameters.length !== 0
    ) {
      throw new Error(
        'Question is not parameterized, but has parameters defined.',
      );
    }

    if (
      this.question.isParameterized &&
      this.question.parameters.length === 0
    ) {
      throw new Error(
        'Question is parameterized, but has no parameters defined.',
      );
    }
  }
}
