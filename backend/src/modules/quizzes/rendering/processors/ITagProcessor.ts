import {IQuestionParameter} from 'shared/interfaces/quiz';

type ParameterMap = Record<string, string | number>;
interface ITagProcessor {
  validate(text: string, parameters?: IQuestionParameter[]): void;
  extract(text: string): string[];
  process(text: string, context: ParameterMap): string;
}

export {ITagProcessor, ParameterMap};
