import {OTLQuestion} from '#quizzes/classes/transformers/Question.js';
import {ILotItem} from '#shared/interfaces/quiz.js';
import {ParameterMap} from '../tag-parser/index.js';
import {TagParser} from '../tag-parser/TagParser.js';
import {BaseQuestionRenderer} from './BaseQuestionRenderer.js';
import {
  ILotItemRenderView,
  OTLQuestionRenderView,
} from './interfaces/RenderViews.js';

function toLotItemRenderView(item: ILotItem): ILotItemRenderView {
  const {explaination, ...rest} = item;
  return rest;
}

class OTLQuestionRenderer extends BaseQuestionRenderer {
  declare question: OTLQuestion;
  declare tagParser: TagParser;

  constructor(question: OTLQuestion, tagParser: TagParser) {
    super(question, tagParser);
  }

  render(parameterMap: ParameterMap): OTLQuestionRenderView {
    const renderedQuestion: OTLQuestion = super.render(
      parameterMap,
    ) as OTLQuestion;

    // Extract lot items from ordering
    const lotItems: ILotItem[] = renderedQuestion.ordering.map(
      order => order.lotItem,
    );

    const lotItemsRenderView: ILotItemRenderView[] =
      lotItems.map(toLotItemRenderView);

    // Process text for each lot item
    const processedLotItems = lotItemsRenderView.map(item => ({
      ...item,
      text: this.tagParser.processText(item.text, parameterMap),
    }));

    // Shuffle the processed lot items
    const shuffledLotItems = processedLotItems.sort(() => Math.random() - 0.5);

    const renderedQuestionWithLotItems: OTLQuestionRenderView = {
      _id: renderedQuestion._id,
      type: renderedQuestion.type,
      isParameterized: renderedQuestion.isParameterized,
      text: renderedQuestion.text,
      hint: renderedQuestion.hint,
      points: renderedQuestion.points,
      timeLimitSeconds: renderedQuestion.timeLimitSeconds,
      lotItems: shuffledLotItems,
      parameterMap: parameterMap,
    };

    return renderedQuestionWithLotItems;
  }
}

export {OTLQuestionRenderer};
