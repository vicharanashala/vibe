import {Tag, ParameterMap} from './Tag';

class QParamTag extends Tag {
  validate(text: string): boolean {
    // Check if the tag content is a valid parameter name
    return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(text.trim());
  }

  extract(text: string): string[] {
    const regex = /<QParam>(.*?)<\/QParam>/gs;
    const matches: string[] = [];
    let match;
    while ((match = regex.exec(text)) !== null) {
      matches.push(match[1]);
    }
    return matches;
  }

  process(text: string, context: ParameterMap): string {
    const paramName = text.trim();
    const value = context[paramName];
    if (value === undefined) {
      throw new Error(`Parameter '${paramName}' not found in context`);
    }
    return value.toString();
  }
}

export {QParamTag};
