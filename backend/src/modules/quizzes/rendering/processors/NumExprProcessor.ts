import {evaluate} from 'mathjs';
import {ITagProcessor, ParameterMap} from './ITagProcessor';

class NumExprProcessor implements ITagProcessor {
  process(tagContent: string, context: ParameterMap): string {
    try {
      const result = evaluate(tagContent, context);
      return result.toString();
    } catch (err) {
      console.error('Error evaluating expression:', tagContent, context);
      throw new Error(`Invalid math expression: ${tagContent}`);
    }
  }
}

export {NumExprProcessor};
