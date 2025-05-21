import {IQuestionParameter} from 'shared/interfaces/quiz';
import {ITagProcessor, ParameterMap} from './processors/ITagProcessor';

class TagParserEngine {
  constructor(private processors: Record<string, ITagProcessor>) {}

  processText(text: string, context: ParameterMap): string {
    return text.replace(/<(\w+)>(.*?)<\/\1>/g, (_, tagName, inner) => {
      const processor = this.processors[tagName];
      return processor ? processor.process(inner, context) : inner;
    });
  }

  isAnyValidTagPresent(text: string): boolean {
    //loop over all processors and run extract function from each and store the resulting list in gobal list.
    const allContents: string[] = [];

    for (const processor of Object.values(this.processors)) {
      const tagContents = processor.extract(text);
      allContents.push(...tagContents);
    }

    //If tagContents list is empty, return false
    return allContents.length === 0 ? false : true;
  }

  validateTags(text: string, parameters?: IQuestionParameter[]): void {
    text.replace(/<(\w+)>(.*?)<\/\1>/g, (matchString, tagName, inner) => {
      const processor = this.processors[tagName];
      processor.validate(inner, parameters);
      return matchString; // Return the original substring to satisfy the type signature
    });
  }
}

export {TagParserEngine};
