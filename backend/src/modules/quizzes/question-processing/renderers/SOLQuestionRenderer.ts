import {SOLQuestion} from '#quizzes/classes/index.js';
import {ILotItem} from '#shared/interfaces/quiz.js';
import {ParameterMap} from '../tag-parser/index.js';
import {TagParser} from '../tag-parser/TagParser.js';
import {BaseQuestionRenderer} from './BaseQuestionRenderer.js';
import {
  ILotItemRenderView,
  SOLQuestionRenderView,
} from './interfaces/RenderViews.js';

function toLotItemRenderView(item: ILotItem): ILotItemRenderView {
  const {explaination, ...rest} = item;
  return rest;
}

class SOLQuestionRenderer extends BaseQuestionRenderer {
  declare question: SOLQuestion;
  declare tagParser: TagParser;

  constructor(question: SOLQuestion, tagParser: TagParser) {
    super(question, tagParser);
  }
  render(parameterMap?: ParameterMap): SOLQuestionRenderView {
    const renderedQuestion: SOLQuestion = super.render(
      parameterMap,
    ) as SOLQuestion;

    const lotItems: ILotItemRenderView[] = [
      toLotItemRenderView(renderedQuestion.correctLotItem),
      ...renderedQuestion.incorrectLotItems.map(toLotItemRenderView),
    ];

    //Shuffle lot items
    let shuffledLotItems = lotItems.sort(() => Math.random() - 0.5);

    if (parameterMap) {
      // Process text in lot items using the tag parser
      shuffledLotItems = lotItems.map(item => ({
        ...item,
        text: this.tagParser.processText(item.text, parameterMap),
      }));
    }

    const renderedQuestionWithLotItems: SOLQuestionRenderView = {
      _id: renderedQuestion._id,
      type: renderedQuestion.type,
      isParameterized: renderedQuestion.isParameterized,
      text: renderedQuestion.text,
      hint: renderedQuestion.hint,
      points: renderedQuestion.points,
      timeLimitSeconds: renderedQuestion.timeLimitSeconds,
      lotItems: shuffledLotItems,
      parameterMap: parameterMap,
      priority: renderedQuestion.priority,
    };

    return renderedQuestionWithLotItems;
  }
}

export {SOLQuestionRenderer};
