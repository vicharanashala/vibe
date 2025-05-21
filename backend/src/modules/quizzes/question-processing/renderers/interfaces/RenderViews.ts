import {BaseQuestion} from 'modules/quizzes/classes/transformers';
import {ILotItem} from 'shared/interfaces/quiz';
import {ParameterMap} from '../../tag-parser';

interface IQuestionRenderView extends BaseQuestion {
  parameterMap?: ParameterMap;
}

interface SOLQuestionRenderView extends IQuestionRenderView {
  lotItems: ILotItem[];
}

export {IQuestionRenderView, SOLQuestionRenderView};
