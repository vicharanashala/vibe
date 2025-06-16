import {BaseQuestion} from '#quizzes/classes/transformers/Question.js';
import { ILotItem } from '#root/shared/interfaces/quiz.js';

import { ParameterMap } from '../../tag-parser/tags/Tag.js';

export type ILotItemRenderView  = Omit<ILotItem, 'explaination'>

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
