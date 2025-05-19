import {ITagProcessor, ParameterMap} from './ITagProcessor';

class QParamProcessor implements ITagProcessor {
  process(tagContent: string, context: ParameterMap): string {
    const paramName = tagContent.trim();
    const value = context[paramName];
    if (value === undefined) {
      throw new Error(`Parameter '${paramName}' not found in context`);
    }
    return value.toString();
  }
}

export {QParamProcessor};
