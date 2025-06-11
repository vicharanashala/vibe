import {SMLQuestion} from '#quizzes/classes/index.js';
import {ILotItem, ILotItemRenderView} from '#shared/index.js';
import {ParameterMap} from '../tag-parser/index.js';
import {TagParser} from '../tag-parser/TagParser.js';
import {BaseQuestionRenderer} from './BaseQuestionRenderer.js';
import {SMLQuestionRenderView} from './interfaces/RenderViews.js';

function toLotItemRenderView(item: ILotItem): ILotItemRenderView {
  const {explaination, ...rest} = item;
  return rest;
}

class SMLQuestionRenderer extends BaseQuestionRenderer {
  declare question: SMLQuestion;
  declare tagParser: TagParser;

  constructor(question: SMLQuestion, tagParser: TagParser) {
    super(question, tagParser);
  }

  render(parameterMap: ParameterMap): SMLQuestionRenderView {
    const renderedQuestion: SMLQuestion = super.render(
      parameterMap,
    ) as SMLQuestion;

    // Combine all lot items (correct and incorrect)
    const lotItems: ILotItemRenderView[] = [
      ...renderedQuestion.correctLotItems.map(toLotItemRenderView),
      ...renderedQuestion.incorrectLotItems.map(toLotItemRenderView),
    ];

    // Process text for each lot item
    const processedLotItems = lotItems.map(item => ({
      ...item,
      text: this.tagParser.processText(item.text, parameterMap),
    }));

    // Shuffle the lot items
    const shuffledLotItems = processedLotItems.sort(() => Math.random() - 0.5);

    const renderedQuestionWithLotItems: SMLQuestionRenderView = {
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

export {SMLQuestionRenderer};
