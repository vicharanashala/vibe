import {BaseQuestion} from '#quizzes/classes/index.js';
import {ParameterMap} from '#quizzes/question-processing/tag-parser/index.js';
import {ILotItemRenderView} from '#shared/index.js';

interface IQuestionRenderView extends BaseQuestion {
  parameterMap?: ParameterMap;
}

interface SOLQuestionRenderView extends IQuestionRenderView {
  lotItems: ILotItemRenderView[];
}

interface SMLQuestionRenderView extends IQuestionRenderView {
  lotItems: ILotItemRenderView[];
}

interface OTLQuestionRenderView extends IQuestionRenderView {
  lotItems: ILotItemRenderView[];
}

interface NATQuestionRenderView extends IQuestionRenderView {
  decimalPrecision: number;
}

type DESQuestionRenderView = IQuestionRenderView;

export {
  IQuestionRenderView,
  SOLQuestionRenderView,
  SMLQuestionRenderView,
  OTLQuestionRenderView,
  NATQuestionRenderView,
  DESQuestionRenderView,
};
