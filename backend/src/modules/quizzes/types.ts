import {QuestionBank} from './classes/transformers/QuestionBank';

const TYPES = {
  //Controllers
  QuestionController: Symbol.for('QuestionController'),

  //Services
  QuestionService: Symbol.for('QuestionService'),
  QuizService: Symbol.for('QuizService'),
  QuestionBankService: Symbol.for('QuestionBankService'),

  //Repositories
  QuestionRepo: Symbol.for('QuestionRepo'),
  QuizRepo: Symbol.for('QuizRepo'),
  AttemptRepo: Symbol.for('AttemptRepo'),
  SubmissionRepo: Symbol.for('SubmissionRepo'),
  UserQuizMetricsRepo: Symbol.for('UserQuizMetricsRepo'),
};

export default TYPES;
