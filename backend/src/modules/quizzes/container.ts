import {ContainerModule} from 'inversify';
import TYPES from './types.js';
import {
  AttemptRepository,
  QuizRepository,
  SubmissionRepository,
  UserQuizMetricsRepository,
} from './repositories/index.js';
import {QuestionRepository} from './repositories/providers/mongodb/QuestionRepository.js';
import {QuestionService} from './services/QuestionService.js';
import {AttemptService} from './services/AttemptService.js';
import {QuestionController} from './controllers/index.js';
import {QuestionBankController} from './controllers/QuestionBankController.js';
import {AttemptController} from './controllers/AttemptController.js';
import {QuestionBankService} from './services/QuestionBankService.js';
import {QuestionBank} from './classes/transformers/QuestionBank.js';
import {QuestionBankRepository} from './repositories/providers/mongodb/QuestionBankRepository.js';

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
  options
    .bind(TYPES.QuestionBankRepo)
    .to(QuestionBankRepository)
    .inSingletonScope();

  // Services
  options.bind(TYPES.QuestionService).to(QuestionService).inSingletonScope();
  options
    .bind(TYPES.QuestionBankService)
    .to(QuestionBankService)
    .inSingletonScope();
  options.bind(TYPES.AttemptService).to(AttemptService).inSingletonScope();

  // Controllers
  options.bind(QuestionController).toSelf().inSingletonScope();
  options.bind(QuestionBankController).toSelf().inSingletonScope();
  options.bind(AttemptController).toSelf().inSingletonScope();
});
