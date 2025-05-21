import {QuestionParameter} from 'modules/quizzes/classes/validators';

function generate(parameter: QuestionParameter): string | number {
  const values = parameter.possibleValues;
  const randIndex = Math.floor(Math.random() * values.length);
  return parameter.type === 'number'
    ? Number(values[randIndex])
    : values[randIndex];
}

function generateRandomParameterMap(params: QuestionParameter[]): ParameterMap {
  const map: ParameterMap = {};
  for (const p of params) {
    map[p.name] = generate(p);
  }
  return map;
}

interface ParameterMap {
  [key: string]: string | number;
}

export {generateRandomParameterMap};
