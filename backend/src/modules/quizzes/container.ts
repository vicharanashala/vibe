import {ContainerModule} from 'inversify';
import TYPES from './types';
import {
  AttemptRepository,
  QuizRepository,
  SubmissionRepository,
  UserQuizMetricsRepository,
} from './repositories';
import {QuestionRepository} from './repositories/providers/mongodb/QuestionRepository';
import {QuestionService} from './services/QuestionService';
import {QuizService} from './services/QuizService';
import {QuestionController} from './controllers';
import {QuestionBankController} from './controllers/QuestionBankController';
import {QuizController} from './controllers/QuizController';
import {QuestionBankService} from './services/QuestionBankService';

export const quizzesContainerModule = new ContainerModule(options => {
  // Repositories
  options.bind(TYPES.AttemptRepo).to(AttemptRepository).inSingletonScope();
  options.bind(TYPES.QuestionRepo).to(QuestionRepository).inSingletonScope();
  options.bind(TYPES.QuizRepo).to(QuizRepository).inSingletonScope();
  options
    .bind(TYPES.SubmissionRepo)
    .to(SubmissionRepository)
    .inSingletonScope();
  options
    .bind(TYPES.UserQuizMetricsRepo)
    .to(UserQuizMetricsRepository)
    .inSingletonScope();

  // Services
  options.bind(TYPES.QuestionService).to(QuestionService).inSingletonScope();
  options
    .bind(TYPES.QuestionBankService)
    .to(QuestionBankService)
    .inSingletonScope();
  options.bind(TYPES.QuizService).to(QuizService).inSingletonScope();

  // Controllers
  options.bind(QuestionController).toSelf().inSingletonScope();
  options.bind(QuestionBankController).toSelf().inSingletonScope();
  options.bind(QuizController).toSelf().inSingletonScope();
});
