import {BaseQuestion} from 'modules/quizzes/classes/transformers';
import {TagParserEngine} from './TagParserEngine';
import {QParamProcessor} from './processors/QParamProcessor';
import {NumExprProcessor} from './processors/NumExprProcessor';
import {NumExprTexProcessor} from './processors/NumExprTexProcessor';
import {ParameterValueFactory} from './ParameterValueFactory';
import {ILotItem} from 'shared/interfaces/quiz';

class QuestionProcessor {
  private tagParser: TagParserEngine;

  constructor() {
    this.tagParser = new TagParserEngine({
      QParam: new QParamProcessor(),
      NumExpr: new NumExprProcessor(),
      NumExprTex: new NumExprTexProcessor(),
    });
  }

  render<T extends BaseQuestion>(question: T): T {
    if (!question.isParameterized || !question.parameters?.length) {
      return question;
    }

    // Generates a map of parameter names to their values
    // This map is used to replace the parameter tags in the question text
    // The values are randomly chosen
    const paramMap = ParameterValueFactory.generateMap(question.parameters);

    const processedText = this.tagParser.processText(question.text, paramMap);
    const processedHint = this.tagParser.processText(question.hint, paramMap);

    // If T is of type SOLQuestion, we need to process the correctLotItem and incorrectLotItems
    if ('correctLotItem' in question && 'incorrectLotItems' in question) {
      const correctLotItem = question.correctLotItem as ILotItem;
      const incorrectLotItems = (question.incorrectLotItems as ILotItem[]).map(
        item => ({
          ...item,
          text: this.tagParser.processText(item.text, paramMap),
          explaination: this.tagParser.processText(item.explaination, paramMap),
        }),
      );

      return {
        ...question,
        text: processedText,
        hint: processedHint,
        correctLotItem: {
          ...correctLotItem,
          text: this.tagParser.processText(correctLotItem.text, paramMap),
          explaination: this.tagParser.processText(
            correctLotItem.explaination,
            paramMap,
          ),
        },
        incorrectLotItems,
      } as T;
    }

    return {
      ...question,
      text: processedText,
      hint: processedHint,
      parameters: question.parameters.map(p => ({
        ...p,
        value: paramMap[p.name],
      })),
    } as T;
  }
}

export {QuestionProcessor as StudentQuestionRenderingStrategy};
