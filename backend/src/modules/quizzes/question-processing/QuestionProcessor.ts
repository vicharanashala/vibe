import {BaseQuestion, SOLQuestion} from 'modules/quizzes/classes/transformers';
import {TagParser} from './tag-parser/TagParser';
import {QParamTag} from './tag-parser/tags/QParamTag';
import {NumExprTag} from './tag-parser/tags/NumExprTag';
import {NumExprTexTag} from './tag-parser/tags/NumExprTexTag';
import {BaseQuestionValidator} from './validators/BaseQuestionValidator';
import {ParameterMap} from './tag-parser/tags/Tag';
import {generateRandomParameterMap} from '../utils/functions/generateRandomParameterMap';
import {
  BaseQuestionRenderer,
  SOLQuestionRenderer,
  IQuestionRenderView,
} from './renderers';
import {SOLQuestionValidator} from './validators';

class QuestionProcessor {
  private tagParser: TagParser;
  private question: BaseQuestion;
  private validator: BaseQuestionValidator;
  private renderer: BaseQuestionRenderer;

  private createValidator(): BaseQuestionValidator {
    switch (this.question.type) {
      case 'SELECT_ONE_IN_LOT':
        return new SOLQuestionValidator(
          this.question as SOLQuestion,
          this.tagParser,
        );
      // Add more cases for other question types as needed
      default:
        throw new Error(
          `No validator found for question type: ${this.question.type}`,
        );
    }
  }

  private createRenderer(): BaseQuestionRenderer {
    switch (this.question.type) {
      case 'SELECT_ONE_IN_LOT':
        return new SOLQuestionRenderer(
          this.question as SOLQuestion,
          this.tagParser,
        );
      // Add more cases for other question types as needed
      default:
        throw new Error(
          `No renderer found for question type: ${this.question.type}`,
        );
    }
  }

  constructor(question: BaseQuestion) {
    this.tagParser = new TagParser({
      QParam: new QParamTag(),
      NumExpr: new NumExprTag(),
      NumExprTex: new NumExprTexTag(),
    });
    this.question = question;
    this.validator = this.createValidator();
    this.renderer = this.createRenderer();
  }

  validate(): void {
    this.validator.validate();
  }

  render(parameterMap?: ParameterMap): BaseQuestion | IQuestionRenderView {
    if (parameterMap) {
      return this.renderer.render(parameterMap);
    }

    // Generates a map of parameter names to their values
    // This map is used to replace the parameter tags in the question text
    // The values are randomly chosen
    const randomParameterMap = generateRandomParameterMap(
      this.question.parameters,
    );
    return this.renderer.render(randomParameterMap);
  }
}

export {QuestionProcessor};
