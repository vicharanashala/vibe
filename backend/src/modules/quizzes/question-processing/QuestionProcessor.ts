import {
  BaseQuestion,
  SMLQuestion,
  SOLQuestion,
  OTLQuestion,
  NATQuestion,
  DESQuestion,
} from 'modules/quizzes/classes/transformers';
import {TagParser} from './tag-parser/TagParser';
import {QParamTag} from './tag-parser/tags/QParamTag';
import {NumExprTag} from './tag-parser/tags/NumExprTag';
import {NumExprTexTag} from './tag-parser/tags/NumExprTexTag';
import {ParameterMap} from './tag-parser/tags/Tag';
import {generateRandomParameterMap} from '../utils/functions/generateRandomParameterMap';
import {
  BaseQuestionRenderer,
  SOLQuestionRenderer,
  IQuestionRenderView,
  SMLQuestionRenderer,
  OTLQuestionRenderer,
  NATQuestionRenderer,
  DESQuestionRenderer,
} from './renderers';
import {
  BaseQuestionValidator,
  SOLQuestionValidator,
  SMLQuestionValidator,
  OTLQuestionValidator,
  NATQuestionValidator,
  DESQuestionValidator,
} from './validators';
import {IGrader} from './graders/interfaces/IGrader';
import {SOLQuestionGrader} from './graders/SOLQuestionGrader';
import {SMLQuestionGrader} from './graders/SMLQuestionGrader';
import {Answer, IQuestionAnswerFeedback} from '../interfaces/grading';
import {QuizItem} from 'modules/courses';

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
    const randomParameterMap = generateRandomParameterMap(
      this.question.parameters,
    );
    return this.renderer.render(randomParameterMap);
  }

  grade(
    answer: Answer,
    quiz: QuizItem,
    parameterMap?: ParameterMap,
  ): Promise<IQuestionAnswerFeedback> {
    return this.grader.grade(answer, quiz);
  }
}

export {QuestionProcessor};
