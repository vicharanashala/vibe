import {ContainerModule} from 'inversify';
import {
  AttemptController,
  QuestionBankController,
  QuestionController,
} from './controllers/index.js';
import {
  AttemptRepository,
  QuizRepository,
  SubmissionRepository,
  UserQuizMetricsRepository,
  QuestionBankRepository,
  QuestionRepository,
} from './repositories/index.js';
import {AttemptService, QuestionBankService} from './services/index.js';
import {QUIZZES_TYPES} from './types.js';
import {QuestionService} from './services/QuestionService.js';

export const quizzesContainerModule = new ContainerModule(options => {
  // Repositories
  options
    .bind(QUIZZES_TYPES.AttemptRepo)
    .to(AttemptRepository)
    .inSingletonScope();
  options
    .bind(QUIZZES_TYPES.QuestionRepo)
    .to(QuestionRepository)
    .inSingletonScope();
  options.bind(QUIZZES_TYPES.QuizRepo).to(QuizRepository).inSingletonScope();
  options
    .bind(QUIZZES_TYPES.SubmissionRepo)
    .to(SubmissionRepository)
    .inSingletonScope();
  options
    .bind(QUIZZES_TYPES.UserQuizMetricsRepo)
    .to(UserQuizMetricsRepository)
    .inSingletonScope();
  options
    .bind(QUIZZES_TYPES.QuestionBankRepo)
    .to(QuestionBankRepository)
    .inSingletonScope();

  // Services
  options
    .bind(QUIZZES_TYPES.QuestionService)
    .to(QuestionService)
    .inSingletonScope();
  options
    .bind(QUIZZES_TYPES.QuestionBankService)
    .to(QuestionBankService)
    .inSingletonScope();
  options
    .bind(QUIZZES_TYPES.AttemptService)
    .to(AttemptService)
    .inSingletonScope();

  // Controllers
  options.bind(QuestionController).toSelf().inSingletonScope();
  options.bind(QuestionBankController).toSelf().inSingletonScope();
  options.bind(AttemptController).toSelf().inSingletonScope();
});
