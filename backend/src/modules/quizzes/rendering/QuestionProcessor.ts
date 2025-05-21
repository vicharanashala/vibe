import {BaseQuestion, SOLQuestion} from 'modules/quizzes/classes/transformers';
import {TagParserEngine} from './TagParserEngine';
import {QParamProcessor} from './processors/QParamProcessor';
import {NumExprProcessor} from './processors/NumExprProcessor';
import {NumExprTexProcessor} from './processors/NumExprTexProcessor';
import {ParameterValueFactory} from './ParameterValueFactory';
import {ILotItem} from 'shared/interfaces/quiz';
import {BaseQuestionValidator} from '../rules/questions/BaseQuestionValidator';
import {SelectOneInLotValidator} from '../rules/questions';
import {triggerAsyncId} from 'async_hooks';
import {ParameterMap} from './processors/ITagProcessor';

interface IQuestionRenderView extends BaseQuestion {
  parameterMap?: ParameterMap;
}

interface SOLQuestionRenderView extends IQuestionRenderView {
  lotItems: ILotItem[];
}

class BaseQuestionRenderer {
  question: BaseQuestion;
  tagParser: TagParserEngine;

  constructor(question: BaseQuestion, tagParser: TagParserEngine) {
    this.question = question;
    this.tagParser = tagParser;
  }

  render(parameterMap: ParameterMap): BaseQuestion | IQuestionRenderView {
    if (!this.question.isParameterized || !this.question.parameters?.length) {
      return this.question;
    }

    const renderedQuestion: BaseQuestion = JSON.parse(
      JSON.stringify(this.question),
    );

    // Apply a function for all these fields in question text, hint, correctItem.text, correctItem.hint
    renderedQuestion.text = this.tagParser.processText(
      this.question.text,
      parameterMap,
    );
    if (this.question.hint) {
      renderedQuestion.hint = this.tagParser.processText(
        this.question.hint,
        parameterMap,
      );
    }
    return renderedQuestion;
  }
}

class SOLQuestionRenderer extends BaseQuestionRenderer {
  declare question: SOLQuestion;
  declare tagParser: TagParserEngine;

  constructor(question: SOLQuestion, tagParser: TagParserEngine) {
    super(question, tagParser);
  }
  render(parameterMap: ParameterMap): SOLQuestionRenderView {
    const renderedQuestion: SOLQuestion = super.render(
      parameterMap,
    ) as SOLQuestion;

    const lotItems: ILotItem[] = [
      renderedQuestion.correctLotItem,
      ...renderedQuestion.incorrectLotItems,
    ];
    const processedLotItems = lotItems.map(item => ({
      ...item,
      text: this.tagParser.processText(item.text, parameterMap),
      explaination: this.tagParser.processText(item.explaination, parameterMap),
    }));

    //Shuffle the lot
    const shuffledLotItems = processedLotItems.sort(() => Math.random() - 0.5);

    const renderedQuestionWithLotItems: SOLQuestionRenderView = {
      ...renderedQuestion,
      lotItems: shuffledLotItems,
    };

    return renderedQuestionWithLotItems;
  }
}

class QuestionProcessor {
  private tagParser: TagParserEngine;
  private question: BaseQuestion;
  private validator: BaseQuestionValidator;
  private renderer: BaseQuestionRenderer;

  private createValidator(question: BaseQuestion): BaseQuestionValidator {
    switch (question.type) {
      case 'SELECT_ONE_IN_LOT':
        return new SelectOneInLotValidator(
          question as SOLQuestion,
          this.tagParser,
        );
      // Add more cases for other question types as needed
      default:
        throw new Error(
          `No validator found for question type: ${question.type}`,
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
    this.tagParser = new TagParserEngine({
      QParam: new QParamProcessor(),
      NumExpr: new NumExprProcessor(),
      NumExprTex: new NumExprTexProcessor(),
    });
    this.question = question;
    this.validator = this.createValidator(question);
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
    const randomParameterMap = ParameterValueFactory.generateMap(
      this.question.parameters,
    );
    return this.renderer.render(randomParameterMap);
  }

  // render<T extends BaseQuestion>(question: T): T {
  //   if (!question.isParameterized || !question.parameters?.length) {
  //     return question;
  //   }

  //   // Generates a map of parameter names to their values
  //   // This map is used to replace the parameter tags in the question text
  //   // The values are randomly chosen
  //   const paramMap = ParameterValueFactory.generateMap(question.parameters);

  //   const processedText = this.tagParser.processText(question.text, paramMap);
  //   const processedHint = this.tagParser.processText(question.hint, paramMap);

  //   // If T is of type SOLQuestion, we need to process the correctLotItem and incorrectLotItems
  //   if ('correctLotItem' in question && 'incorrectLotItems' in question) {
  //     const correctLotItem = question.correctLotItem as ILotItem;
  //     const incorrectLotItems = (question.incorrectLotItems as ILotItem[]).map(
  //       item => ({
  //         ...item,
  //         text: this.tagParser.processText(item.text, paramMap),
  //         explaination: this.tagParser.processText(item.explaination, paramMap),
  //       }),
  //     );

  //     return {
  //       ...question,
  //       text: processedText,
  //       hint: processedHint,
  //       correctLotItem: {
  //         ...correctLotItem,
  //         text: this.tagParser.processText(correctLotItem.text, paramMap),
  //         explaination: this.tagParser.processText(
  //           correctLotItem.explaination,
  //           paramMap,
  //         ),
  //       },
  //       incorrectLotItems,
  //     } as T;
  //   }

  //   return {
  //     ...question,
  //     text: processedText,
  //     hint: processedHint,
  //     parameters: question.parameters.map(p => ({
  //       ...p,
  //       value: paramMap[p.name],
  //     })),
  //   } as T;
  // }
}

export {QuestionProcessor};
