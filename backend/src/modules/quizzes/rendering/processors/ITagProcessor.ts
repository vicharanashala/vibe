type ParameterMap = Record<string, string | number>;
interface ITagProcessor {
  process(tagContent: string, context: ParameterMap): string;
}

export {ITagProcessor, ParameterMap};
