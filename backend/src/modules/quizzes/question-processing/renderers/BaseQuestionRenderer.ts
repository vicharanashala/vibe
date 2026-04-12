import {BaseQuestion} from '#quizzes/classes/transformers/Question.js';
import {ParameterMap} from '../tag-parser/tags/Tag.js';
import {TagParser} from '../tag-parser/TagParser.js';
import {IQuestionRenderView} from './interfaces/RenderViews.js';

class BaseQuestionRenderer {
  question: BaseQuestion;
  tagParser: TagParser;

  constructor(question: BaseQuestion, tagParser: TagParser) {
    this.question = question;
    this.tagParser = tagParser;
  }

  render(parameterMap?: ParameterMap): BaseQuestion | IQuestionRenderView {
    if (!this.question.isParameterized || !this.question.parameters?.length) {
      return this.question;
    }

    const renderedQuestion: BaseQuestion = JSON.parse(
      JSON.stringify(this.question),
    );

    // Apply a function for all these fields in question text, hint, correctItem.text, correctItem.hint
    renderedQuestion.text = this.tagParser.processText(
      this.question.text,
      parameterMap,
    );
    if (this.question.hint) {
      renderedQuestion.hint = this.tagParser.processText(
        this.question.hint,
        parameterMap,
      );
    }
    return renderedQuestion;
  }
}

export {BaseQuestionRenderer};
