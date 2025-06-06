import {BaseQuestion} from '#quizzes/classes/index.js';
import {ParameterMap} from '#quizzes/question-processing/tag-parser/index.js';
import {ILotItem} from '#shared/index.js';

interface IQuestionRenderView extends BaseQuestion {
  parameterMap?: ParameterMap;
}

interface SOLQuestionRenderView extends IQuestionRenderView {
  lotItems: ILotItem[];
}

interface SMLQuestionRenderView extends IQuestionRenderView {
  lotItems: ILotItem[];
}

interface OTLQuestionRenderView extends IQuestionRenderView {
  lotItems: ILotItem[];
}

interface NATQuestionRenderView extends IQuestionRenderView {
  decimalPrecision: number;
  upperLimit: number;
  lowerLimit: number;
  value?: number;
  expression?: string;
}

interface DESQuestionRenderView extends IQuestionRenderView {
  solutionText: string;
}

export {
  IQuestionRenderView,
  SOLQuestionRenderView,
  SMLQuestionRenderView,
  OTLQuestionRenderView,
  NATQuestionRenderView,
  DESQuestionRenderView,
};
