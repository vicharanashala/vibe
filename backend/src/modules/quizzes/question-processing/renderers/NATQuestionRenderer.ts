import {NATQuestion} from 'modules/quizzes/classes/transformers';
import {TagParser, ParameterMap} from '../tag-parser';
import {BaseQuestionRenderer} from './BaseQuestionRenderer';
import {NATQuestionRenderView} from './interfaces/RenderViews';

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
      upperLimit: renderedQuestion.upperLimit,
      lowerLimit: renderedQuestion.lowerLimit,
      value: renderedQuestion.value,
      expression: renderedQuestion.expression,
      parameterMap: parameterMap,
    };

    return renderedQuestionView;
  }
}

export {NATQuestionRenderer};
