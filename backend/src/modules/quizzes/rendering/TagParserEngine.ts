import {ITagProcessor, ParameterMap} from './processors/ITagProcessor';

class TagParserEngine {
  constructor(private processors: Record<string, ITagProcessor>) {}

  processText(text: string, context: ParameterMap): string {
    return text.replace(/<(\w+)>(.*?)<\/\1>/g, (_, tagName, inner) => {
      const processor = this.processors[tagName];
      return processor ? processor.process(inner, context) : inner;
    });
  }
}

export {TagParserEngine};
