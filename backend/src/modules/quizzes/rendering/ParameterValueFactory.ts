import {QuestionParameter} from '../classes/validators';
import {ParameterMap} from './processors/ITagProcessor';

class ParameterValueFactory {
  private static generate(parameter: QuestionParameter): string | number {
    const values = parameter.possibleValues;
    const randIndex = Math.floor(Math.random() * values.length);
    return parameter.type === 'number'
      ? Number(values[randIndex])
      : values[randIndex];
  }

  static generateMap(params: QuestionParameter[]): ParameterMap {
    const map: ParameterMap = {};
    for (const p of params) {
      map[p.name] = this.generate(p);
    }
    return map;
  }
}

export {ParameterValueFactory};
