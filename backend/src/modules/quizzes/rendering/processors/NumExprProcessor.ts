import {evaluate, parse, SymbolNode} from 'mathjs';
import {ITagProcessor, ParameterMap} from './ITagProcessor';
import {IQuesionOptionsLotItem} from 'shared/interfaces/Models';
import {IQuestionParameter} from 'shared/interfaces/quiz';

class NumExprProcessor implements ITagProcessor {
  validate(text: string, parameters?: IQuestionParameter[]): void {
    evaluate(text);
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
    const regex = /<NumExpr>(.*?)<\/NumExpr>/gs;
    const matches: string[] = [];
    let match;
    while ((match = regex.exec(text)) !== null) {
      matches.push(match[1]);
    }
    return matches;
  }

  process(text: string, context: ParameterMap): string {
    try {
      const result = evaluate(text, context);
      return result.toString();
    } catch (err) {
      console.error('Error evaluating expression:', text, context);
      throw new Error(`Invalid math expression: ${text}`);
    }
  }
}

export {NumExprProcessor};
