import {BaseQuestion} from 'modules/quizzes/classes/transformers';
import {ILotItem} from 'shared/interfaces/quiz';
import {ParameterMap} from '../../tag-parser';

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
