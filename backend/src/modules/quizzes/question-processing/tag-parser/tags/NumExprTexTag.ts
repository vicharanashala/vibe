import {parse, SymbolNode} from 'mathjs';
import {Tag, ParameterMap} from './Tag';
import {IQuestionParameter} from 'shared/interfaces/quiz';

class NumExprTexTag extends Tag {
  validate(text: string, parameters: IQuestionParameter[]): void {
    parse(text);
    if (parameters) {
      const paramMap = new Map(parameters.map(p => [p.name, p]));
      const parsedNode = parse(text);
      const symbols = [];

      // Traverse the parsed node to collect all symbols
      parsedNode.traverse((node: SymbolNode) => {
        if (node.isSymbolNode) {
          symbols.push(node.name);
        }
      });

      const uniqueSymbols = Array.from(new Set(symbols));

      for (const symbol of uniqueSymbols) {
        // Check if all symbols are defined in parameters
        if (!paramMap.has(symbol)) {
          throw new Error(`Variable '${symbol}' not found in parameters.`);
        }
        // Check if the type of the symbol is 'number'
        const param = paramMap.get(symbol);
        if (param && param.type !== 'number') {
          throw new Error(`Variable '${symbol}' must be of type 'number'.`);
        }
      }
    }
  }

  extract(text: string): string[] {
    const regex = /<NumExprTex>(.*?)<\/NumExprTex>/gs;
    const matches: string[] = [];
    let match;
    while ((match = regex.exec(text)) !== null) {
      matches.push(match[1]);
    }
    return matches;
  }

  process(text: string, context: ParameterMap): string {
    try {
      // Replace all variable names in the expression with their corresponding values from the context.
      // This regular expression matches variable-like words (letters, digits, and underscores)
      // and replaces them with actual values if found in the context map.
      const exprWithValues = text.replace(
        /\b([a-zA-Z_][a-zA-Z0-9_]*)\b/g,
        match => {
          return context[match] !== undefined
            ? context[match].toString()
            : match;
        },
      );

      const node = parse(exprWithValues);
      return `$${node.toTex()}$`;
    } catch (err) {
      throw new Error(`Invalid TeX expression: ${text}`);
    }
  }
}

export {NumExprTexTag};
