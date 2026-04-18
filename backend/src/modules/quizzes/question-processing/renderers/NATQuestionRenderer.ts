import {NATQuestion} from '#quizzes/classes/transformers/Question.js';
import {ParameterMap} from '../tag-parser/tags/Tag.js';
import {TagParser} from '../tag-parser/TagParser.js';
import {BaseQuestionRenderer} from './BaseQuestionRenderer.js';
import {NATQuestionRenderView} from './interfaces/RenderViews.js';

class NATQuestionRenderer extends BaseQuestionRenderer {
  declare question: NATQuestion;
  declare tagParser: TagParser;

  constructor(question: NATQuestion, tagParser: TagParser) {
    super(question, tagParser);
  }

  render(parameterMap: ParameterMap): NATQuestionRenderView {
    // Use the base renderer to process text and hint
    const renderedQuestion: NATQuestion = super.render(
      parameterMap,
    ) as NATQuestion;

    const renderedQuestionView: NATQuestionRenderView = {
      _id: renderedQuestion._id,
      type: renderedQuestion.type,
      isParameterized: renderedQuestion.isParameterized,
      text: renderedQuestion.text,
      hint: renderedQuestion.hint,
      points: renderedQuestion.points,
      timeLimitSeconds: renderedQuestion.timeLimitSeconds,
      decimalPrecision: renderedQuestion.decimalPrecision,
      parameterMap: parameterMap,
    };

    return renderedQuestionView;
  }
}

export {NATQuestionRenderer};
