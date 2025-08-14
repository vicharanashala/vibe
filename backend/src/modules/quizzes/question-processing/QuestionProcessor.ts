import {QuizItem} from '#courses/classes/transformers/Item.js';
import {
  BaseQuestion,
  SOLQuestion,
  SMLQuestion,
  OTLQuestion,
  NATQuestion,
  DESQuestion,
} from '#quizzes/classes/transformers/Question.js';
import {Answer, IQuestionAnswerFeedback} from '#quizzes/interfaces/grading.js';
import {generateRandomParameterMap} from '#quizzes/utils/functions/generateRandomParameterMap.js';
import {DESQuestionGrader} from './graders/DESQuestionGrader.js';
import {IGrader} from './graders/interfaces/IGrader.js';
import {NATQuestionGrader} from './graders/NATQuestionGrader.js';
import {OTLQuestionGrader} from './graders/OTLQuestionGrader.js';
import {SMLQuestionGrader} from './graders/SMLQuestionGrader.js';
import {SOLQuestionGrader} from './graders/SOLQuestionGrader.js';
import {BaseQuestionRenderer} from './renderers/BaseQuestionRenderer.js';
import {DESQuestionRenderer} from './renderers/DESQuestionRenderer.js';
import {IQuestionRenderView} from './renderers/interfaces/RenderViews.js';
import {NATQuestionRenderer} from './renderers/NATQuestionRenderer.js';
import {OTLQuestionRenderer} from './renderers/OTLQuestionRenderer.js';
import {SMLQuestionRenderer} from './renderers/SMLQuestionRenderer.js';
import {SOLQuestionRenderer} from './renderers/SOLQuestionRenderer.js';
import {TagParser} from './tag-parser/TagParser.js';
import {NumExprTag} from './tag-parser/tags/NumExprTag.js';
import {NumExprTexTag} from './tag-parser/tags/NumExprTexTag.js';
import {QParamTag} from './tag-parser/tags/QParamTag.js';
import {ParameterMap} from './tag-parser/tags/Tag.js';
import {BaseQuestionValidator} from './validators/BaseQuestionValidator.js';
import {DESQuestionValidator} from './validators/DESQuestionValidator.js';
import {NATQuestionValidator} from './validators/NATQuestionValidator.js';
import {OTLQuestionValidator} from './validators/OTLQuestionValidator.js';
import {SMLQuestionValidator} from './validators/SMLQuestionValidator.js';
import {SOLQuestionValidator} from './validators/SOLQuestionValidator.js';

class QuestionProcessor {
  private tagParser: TagParser;
  private question: BaseQuestion;
  private validator: BaseQuestionValidator;
  private renderer: BaseQuestionRenderer;
  private grader: IGrader;

  private createValidator(): BaseQuestionValidator {
    switch (this.question.type) {
      case 'SELECT_ONE_IN_LOT':
        return new SOLQuestionValidator(
          this.question as SOLQuestion,
          this.tagParser,
        );
      case 'SELECT_MANY_IN_LOT':
        return new SMLQuestionValidator(
          this.question as SMLQuestion,
          this.tagParser,
        );
      case 'ORDER_THE_LOTS':
        return new OTLQuestionValidator(
          this.question as OTLQuestion,
          this.tagParser,
        );
      case 'NUMERIC_ANSWER_TYPE':
        return new NATQuestionValidator(
          this.question as NATQuestion,
          this.tagParser,
        );
      case 'DESCRIPTIVE':
        return new DESQuestionValidator(
          this.question as DESQuestion,
          this.tagParser,
        );
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
      case 'SELECT_MANY_IN_LOT':
        return new SMLQuestionRenderer(
          this.question as SMLQuestion,
          this.tagParser,
        );
      case 'ORDER_THE_LOTS':
        return new OTLQuestionRenderer(
          this.question as OTLQuestion,
          this.tagParser,
        );
      case 'NUMERIC_ANSWER_TYPE':
        return new NATQuestionRenderer(
          this.question as NATQuestion,
          this.tagParser,
        );
      case 'DESCRIPTIVE':
        return new DESQuestionRenderer(
          this.question as DESQuestion,
          this.tagParser,
        );
      default:
        throw new Error(
          `No renderer found for question type: ${this.question.type}`,
        );
    }
  }

  private createGrader(): IGrader {
    switch (this.question.type) {
      case 'SELECT_ONE_IN_LOT':
        return new SOLQuestionGrader(this.question as SOLQuestion);
      case 'SELECT_MANY_IN_LOT':
        return new SMLQuestionGrader(this.question as SMLQuestion);
      case 'ORDER_THE_LOTS':
        return new OTLQuestionGrader(this.question as OTLQuestion);
      case 'NUMERIC_ANSWER_TYPE':
        return new NATQuestionGrader(this.question as NATQuestion);
      case 'DESCRIPTIVE':
        return new DESQuestionGrader(this.question as DESQuestion);
      default:
        throw new Error(
          `No grader found for question type: ${this.question.type}`,
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
    this.grader = this.createGrader();
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
    if (!this.question.isParameterized) {
      return this.renderer.render();
    }
    const randomParameterMap = generateRandomParameterMap(
      this.question.parameters,
    );
    return this.renderer.render(randomParameterMap);
  }

  grade(
    answer: Answer,
    quiz: QuizItem,
    parameterMap?: ParameterMap,
    selectedAnswerTexts?: string []
  ): Promise<IQuestionAnswerFeedback> {
    return this.grader.grade(answer, quiz, parameterMap, selectedAnswerTexts);
  }
}

export {QuestionProcessor};
