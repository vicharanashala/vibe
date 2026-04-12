import {IQuestionParameter} from '#shared/interfaces/quiz.js';


// TODO: Not compatible with Open Api schema, need to revamp it
type ParameterMap = Record<string, string | number>;
abstract class Tag {
  abstract validate(text: string, parameters?: IQuestionParameter[]): void;
  abstract extract(text: string): string[];
  abstract process(text: string, context: ParameterMap): string;
}

export {Tag, ParameterMap};
