import {OTLQuestion} from 'modules/quizzes/classes/transformers';
import {ILotItem} from 'shared/interfaces/quiz';
import {TagParser, ParameterMap} from '../tag-parser';
import {BaseQuestionRenderer} from './BaseQuestionRenderer';
import {OTLQuestionRenderView} from './interfaces/RenderViews';

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

    // Process text and explanation for each lot item
    const processedLotItems = lotItems.map(item => ({
      ...item,
      text: this.tagParser.processText(item.text, parameterMap),
      explaination: this.tagParser.processText(item.explaination, parameterMap),
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
