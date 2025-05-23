import {parse} from 'mathjs';
import {ITagProcessor, ParameterMap} from './ITagProcessor';

class NumExprTexProcessor implements ITagProcessor {
  process(tagContent: string, context: ParameterMap): string {
    try {
      // Replace all variable names in the expression with their corresponding values from the context.
      // This regular expression matches variable-like words (letters, digits, and underscores)
      // and replaces them with actual values if found in the context map.
      const exprWithValues = tagContent.replace(
        /\b([a-zA-Z_][a-zA-Z0-9_]*)\b/g,
        match => {
          return context[match] !== undefined
            ? context[match].toString()
            : match;
        },
      );

      const node = parse(exprWithValues);
      return node.toTex();
    } catch (err) {
      throw new Error(`Invalid TeX expression: ${tagContent}`);
    }
  }
}

export {NumExprTexProcessor};
